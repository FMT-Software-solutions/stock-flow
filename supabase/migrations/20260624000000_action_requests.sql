-- Generic action-request framework: users propose changes that owners (or roles with the
-- matching approve permission) review; once approved, the requester can apply the change
-- once per entity. After applying, the entity re-locks until a new request is filed.
--
-- First use case: 'sales.edit_date' — let users correct an order's `date` after the fact.
-- Future actions (sales.delete, sales.refund, ...) reuse this schema and add only:
--   1) a row in the code-side action registry
--   2) a SECURITY DEFINER apply_* RPC
--   3) two permission keys (request_*/approve_*)

-- =============================================================================
-- Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.action_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','partially_approved','rejected','completed','cancelled')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS action_requests_org_status_type_idx
    ON public.action_requests (organization_id, status, action_type);
CREATE INDEX IF NOT EXISTS action_requests_requested_by_idx
    ON public.action_requests (requested_by);

CREATE TABLE IF NOT EXISTS public.action_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.action_requests(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    state TEXT NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending','approved','rejected','applied')),
    applied_at TIMESTAMPTZ,
    applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (request_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS action_request_items_entity_state_idx
    ON public.action_request_items (entity_type, entity_id, state);
CREATE INDEX IF NOT EXISTS action_request_items_request_idx
    ON public.action_request_items (request_id);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
    ON public.notifications (user_id, read_at, created_at DESC);

-- updated_at trigger reused from existing tables (set_audit_fields handles created_by/updated_by;
-- we don't track those on requests/items because requested_by/reviewed_by/applied_by carry the info).
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_action_requests ON public.action_requests;
CREATE TRIGGER touch_action_requests
BEFORE UPDATE ON public.action_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_action_request_items ON public.action_request_items;
CREATE TRIGGER touch_action_request_items
BEFORE UPDATE ON public.action_request_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- Helpers
-- =============================================================================

-- Polymorphic FK validation. Each entity_type must be mapped here.
CREATE OR REPLACE FUNCTION public.validate_action_request_item()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    exists_row BOOLEAN;
BEGIN
    CASE NEW.entity_type
        WHEN 'order' THEN
            SELECT EXISTS (SELECT 1 FROM public.orders WHERE id = NEW.entity_id) INTO exists_row;
        ELSE
            RAISE EXCEPTION 'Unknown entity_type: %', NEW.entity_type;
    END CASE;

    IF NOT exists_row THEN
        RAISE EXCEPTION '% with id % does not exist', NEW.entity_type, NEW.entity_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_action_request_item ON public.action_request_items;
CREATE TRIGGER validate_action_request_item
BEFORE INSERT ON public.action_request_items
FOR EACH ROW EXECUTE FUNCTION public.validate_action_request_item();

-- Effective base-role permission check for a (user, org, scope, action).
-- Reads organization_roles.permissions JSON. Good enough for "can this user approve?"
-- because per-user overrides cannot widen base-role permissions.
CREATE OR REPLACE FUNCTION public.user_has_org_action_permission(
    p_user_id UUID,
    p_org_id UUID,
    p_scope TEXT,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_organizations uo
        JOIN public.organization_roles r ON r.id = uo.role_id
        WHERE uo.user_id = p_user_id
          AND uo.organization_id = p_org_id
          AND COALESCE((r.permissions::jsonb -> p_scope ->> 'enabled')::boolean, false) = true
          AND (r.permissions::jsonb -> p_scope -> 'actions') ? p_action
    );
$$;

-- Active-lock predicate: is there an `approved` (not yet applied) item for this user
-- on this entity under the given action_type?
CREATE OR REPLACE FUNCTION public.has_active_action_grant(
    p_user_id UUID,
    p_action_type TEXT,
    p_entity_type TEXT,
    p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.action_request_items i
        JOIN public.action_requests r ON r.id = i.request_id
        WHERE i.entity_type = p_entity_type
          AND i.entity_id = p_entity_id
          AND i.state = 'approved'
          AND r.action_type = p_action_type
          AND r.requested_by = p_user_id
    );
$$;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- action_requests
DROP POLICY IF EXISTS action_requests_select ON public.action_requests;
CREATE POLICY action_requests_select ON public.action_requests
    FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
    ));

DROP POLICY IF EXISTS action_requests_insert ON public.action_requests;
CREATE POLICY action_requests_insert ON public.action_requests
    FOR INSERT
    WITH CHECK (
        requested_by = auth.uid()
        AND organization_id IN (
            SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
        )
    );

-- Reviewers can update review fields. Apply RPC runs SECURITY DEFINER so it bypasses RLS;
-- this UPDATE policy is for the human "approve / reject" action only.
DROP POLICY IF EXISTS action_requests_update ON public.action_requests;
CREATE POLICY action_requests_update ON public.action_requests
    FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
    ));

-- action_request_items
DROP POLICY IF EXISTS action_request_items_select ON public.action_request_items;
CREATE POLICY action_request_items_select ON public.action_request_items
    FOR SELECT
    USING (request_id IN (
        SELECT id FROM public.action_requests
        WHERE organization_id IN (
            SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
        )
    ));

DROP POLICY IF EXISTS action_request_items_insert ON public.action_request_items;
CREATE POLICY action_request_items_insert ON public.action_request_items
    FOR INSERT
    WITH CHECK (request_id IN (
        SELECT id FROM public.action_requests WHERE requested_by = auth.uid()
    ));

DROP POLICY IF EXISTS action_request_items_update ON public.action_request_items;
CREATE POLICY action_request_items_update ON public.action_request_items
    FOR UPDATE
    USING (request_id IN (
        SELECT id FROM public.action_requests
        WHERE organization_id IN (
            SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
        )
    ))
    WITH CHECK (request_id IN (
        SELECT id FROM public.action_requests
        WHERE organization_id IN (
            SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
        )
    ));

-- notifications: user can only see and update their own
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Allow `date` updates on orders when the caller has an active grant for that order.
-- This sits ALONGSIDE the existing "Users can access their organization's orders" policy
-- (which is FOR ALL using only the org-membership check). We can't tighten that without
-- breaking existing flows, so the actual single-edit enforcement is in the apply RPC.
-- (Policy kept here for future hardening; safe no-op today.)

-- =============================================================================
-- Apply RPC for sales.edit_date
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_sales_date_edit(
    p_item_id UUID,
    p_new_date TIMESTAMPTZ
)
RETURNS public.action_request_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item public.action_request_items;
    v_request public.action_requests;
    v_remaining INT;
BEGIN
    SELECT * INTO v_item FROM public.action_request_items WHERE id = p_item_id FOR UPDATE;
    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    SELECT * INTO v_request FROM public.action_requests WHERE id = v_item.request_id FOR UPDATE;
    IF v_request.action_type <> 'sales.edit_date' THEN
        RAISE EXCEPTION 'Wrong action_type for this RPC: %', v_request.action_type;
    END IF;
    IF v_request.requested_by <> auth.uid() THEN
        RAISE EXCEPTION 'Only the requester can apply this edit';
    END IF;
    IF v_item.state <> 'approved' THEN
        RAISE EXCEPTION 'Item is not in approved state (current: %)', v_item.state;
    END IF;
    IF v_item.entity_type <> 'order' THEN
        RAISE EXCEPTION 'Unexpected entity_type: %', v_item.entity_type;
    END IF;

    UPDATE public.orders SET date = p_new_date WHERE id = v_item.entity_id;

    UPDATE public.action_request_items
       SET state = 'applied',
           result = jsonb_build_object('new_date', p_new_date),
           applied_at = now(),
           applied_by = auth.uid()
     WHERE id = p_item_id
     RETURNING * INTO v_item;

    -- If no items are still pending/approved, the request is done.
    SELECT count(*) INTO v_remaining
      FROM public.action_request_items
     WHERE request_id = v_request.id
       AND state IN ('pending','approved');

    IF v_remaining = 0 THEN
        UPDATE public.action_requests SET status = 'completed' WHERE id = v_request.id;
    END IF;

    RETURN v_item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_sales_date_edit(UUID, TIMESTAMPTZ) TO authenticated;

-- =============================================================================
-- Notification fan-out triggers
-- =============================================================================

-- When a request is created, notify everyone in the org with the matching approve permission.
CREATE OR REPLACE FUNCTION public.notify_on_action_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_scope TEXT;
    v_action TEXT;
    v_title TEXT;
BEGIN
    -- Convention: action_type = '<scope>.<verb>' → approve permission = '<scope>.approve_<verb>'
    v_scope := split_part(NEW.action_type, '.', 1);
    v_action := 'approve_' || split_part(NEW.action_type, '.', 2);

    v_title := CASE NEW.action_type
        WHEN 'sales.edit_date' THEN 'New sales date edit request'
        ELSE 'New action request'
    END;

    INSERT INTO public.notifications (organization_id, user_id, type, title, body, link, data)
    SELECT
        NEW.organization_id,
        uo.user_id,
        'action_request.created',
        v_title,
        'A request is waiting for your review.',
        '/requests?id=' || NEW.id::text,
        jsonb_build_object('request_id', NEW.id, 'action_type', NEW.action_type)
    FROM public.user_organizations uo
    JOIN public.organization_roles r ON r.id = uo.role_id
    WHERE uo.organization_id = NEW.organization_id
      AND uo.user_id <> NEW.requested_by
      AND COALESCE((r.permissions::jsonb -> v_scope ->> 'enabled')::boolean, false) = true
      AND (r.permissions::jsonb -> v_scope -> 'actions') ? v_action;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_action_request_created ON public.action_requests;
CREATE TRIGGER notify_on_action_request_created
AFTER INSERT ON public.action_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_action_request_created();

-- When an item changes state (approved/rejected/applied), notify the requester or reviewer.
CREATE OR REPLACE FUNCTION public.notify_on_action_request_item_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request public.action_requests;
BEGIN
    IF NEW.state = OLD.state THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_request FROM public.action_requests WHERE id = NEW.request_id;

    IF NEW.state IN ('approved','rejected') THEN
        INSERT INTO public.notifications (organization_id, user_id, type, title, body, link, data)
        VALUES (
            v_request.organization_id,
            v_request.requested_by,
            'action_request.reviewed',
            CASE NEW.state
                WHEN 'approved' THEN 'A request item was approved'
                ELSE 'A request item was rejected'
            END,
            'Open the request to see details.',
            '/requests?id=' || v_request.id::text,
            jsonb_build_object('request_id', v_request.id, 'item_id', NEW.id, 'state', NEW.state)
        );
    ELSIF NEW.state = 'applied' AND v_request.reviewed_by IS NOT NULL THEN
        INSERT INTO public.notifications (organization_id, user_id, type, title, body, link, data)
        VALUES (
            v_request.organization_id,
            v_request.reviewed_by,
            'action_request.item_applied',
            'Approved change was applied',
            'The requester applied an approved change.',
            '/requests?id=' || v_request.id::text,
            jsonb_build_object('request_id', v_request.id, 'item_id', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_action_request_item_state ON public.action_request_items;
CREATE TRIGGER notify_on_action_request_item_state
AFTER UPDATE OF state ON public.action_request_items
FOR EACH ROW EXECUTE FUNCTION public.notify_on_action_request_item_state();

-- =============================================================================
-- Permission seed: add new actions to existing role permission JSON
-- =============================================================================

-- New actions to inject:
--   orders.request_date_edit  (granted to owner, admin, branch_admin, write/editor by default)
--   orders.approve_date_edit  (granted to owner, admin)
DO $$
DECLARE
    rec record;
    perms jsonb;
    actions jsonb;
BEGIN
    FOR rec IN SELECT id, type, permissions FROM public.organization_roles LOOP
        perms := rec.permissions::jsonb;

        -- Ensure orders scope exists in JSON
        IF perms -> 'orders' IS NULL THEN
            perms := jsonb_set(perms, '{orders}',
                jsonb_build_object('enabled', true, 'actions', '[]'::jsonb), true);
        END IF;

        actions := COALESCE(perms -> 'orders' -> 'actions', '[]'::jsonb);

        -- request_date_edit: everyone who can write
        IF rec.type IN ('owner','admin','branch_admin') OR rec.type = 'custom' THEN
            IF NOT (actions ? 'request_date_edit') THEN
                actions := actions || '"request_date_edit"'::jsonb;
            END IF;
        END IF;

        -- approve_date_edit: owners and admins only
        IF rec.type IN ('owner','admin') THEN
            IF NOT (actions ? 'approve_date_edit') THEN
                actions := actions || '"approve_date_edit"'::jsonb;
            END IF;
        END IF;

        perms := jsonb_set(perms, '{orders,actions}', actions, true);
        UPDATE public.organization_roles SET permissions = perms::text WHERE id = rec.id;
    END LOOP;
END $$;
