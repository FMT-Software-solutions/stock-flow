-- Fixes two issues from the initial action-requests migration:
--   1. notify_on_action_request_created derived the permission scope from action_type's prefix
--      (e.g. 'sales' from 'sales.edit_date'), but the permission scope is actually 'orders'.
--      That meant no rows matched the WHERE clause and zero notifications were inserted.
--   2. Nothing prevented filing multiple active requests for the same order. Per spec, an
--      entity is "locked" while it has a pending or approved item under that action_type.

-- =============================================================================
-- 1. Action-type → permission key mapping (used by triggers and any future code)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.action_request_permission_keys(p_action_type TEXT)
RETURNS TABLE (scope TEXT, request_action TEXT, approve_action TEXT)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_action_type
        WHEN 'sales.edit_date' THEN 'orders'
        ELSE NULL
    END,
    CASE p_action_type
        WHEN 'sales.edit_date' THEN 'request_date_edit'
        ELSE NULL
    END,
    CASE p_action_type
        WHEN 'sales.edit_date' THEN 'approve_date_edit'
        ELSE NULL
    END;
$$;

-- =============================================================================
-- 2. Fix notification fan-out for new requests
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_action_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_scope TEXT;
    v_approve_action TEXT;
    v_title TEXT;
BEGIN
    SELECT scope, approve_action
      INTO v_scope, v_approve_action
      FROM public.action_request_permission_keys(NEW.action_type);

    IF v_scope IS NULL THEN
        RAISE WARNING 'No permission mapping for action_type %, skipping notification fan-out', NEW.action_type;
        RETURN NEW;
    END IF;

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
      AND (r.permissions::jsonb -> v_scope -> 'actions') ? v_approve_action;

    RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. Backfill notifications for any in-flight requests whose fan-out was skipped
-- =============================================================================

INSERT INTO public.notifications (organization_id, user_id, type, title, body, link, data)
SELECT
    req.organization_id,
    uo.user_id,
    'action_request.created',
    CASE req.action_type
        WHEN 'sales.edit_date' THEN 'New sales date edit request'
        ELSE 'New action request'
    END,
    'A request is waiting for your review.',
    '/requests?id=' || req.id::text,
    jsonb_build_object('request_id', req.id, 'action_type', req.action_type)
FROM public.action_requests req
CROSS JOIN LATERAL public.action_request_permission_keys(req.action_type) k
JOIN public.user_organizations uo
  ON uo.organization_id = req.organization_id
 AND uo.user_id <> req.requested_by
JOIN public.organization_roles r ON r.id = uo.role_id
WHERE req.status IN ('pending', 'partially_approved')
  AND k.scope IS NOT NULL
  AND COALESCE((r.permissions::jsonb -> k.scope ->> 'enabled')::boolean, false) = true
  AND (r.permissions::jsonb -> k.scope -> 'actions') ? k.approve_action
  -- Don't duplicate notifications that already exist for the same (user, request)
  AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = uo.user_id
        AND (n.data ->> 'request_id')::uuid = req.id
        AND n.type = 'action_request.created'
  );

-- =============================================================================
-- 4. Block duplicate active requests for the same entity
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_single_active_action_request_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_action_type TEXT;
    v_conflict UUID;
BEGIN
    SELECT action_type INTO v_action_type FROM public.action_requests WHERE id = NEW.request_id;

    SELECT i.id INTO v_conflict
    FROM public.action_request_items i
    JOIN public.action_requests r ON r.id = i.request_id
    WHERE i.entity_type = NEW.entity_type
      AND i.entity_id = NEW.entity_id
      AND r.action_type = v_action_type
      AND i.state IN ('pending', 'approved')
      AND i.id <> NEW.id
    LIMIT 1;

    IF v_conflict IS NOT NULL THEN
        RAISE EXCEPTION 'This % already has an open request. Wait for it to be reviewed or applied before requesting again.', NEW.entity_type
            USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_active_action_request_item ON public.action_request_items;
CREATE TRIGGER enforce_single_active_action_request_item
BEFORE INSERT ON public.action_request_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_active_action_request_item();

-- =============================================================================
-- 5. Race-condition safety: when an item is applied, cancel sibling pending/approved
--    items for the same entity under the same action_type in OTHER requests.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.invalidate_sibling_action_request_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_action_type TEXT;
BEGIN
    IF NEW.state <> 'applied' OR OLD.state = 'applied' THEN
        RETURN NEW;
    END IF;

    SELECT action_type INTO v_action_type FROM public.action_requests WHERE id = NEW.request_id;

    UPDATE public.action_request_items i
       SET state = 'rejected',
           updated_at = now()
      FROM public.action_requests r
     WHERE r.id = i.request_id
       AND r.action_type = v_action_type
       AND i.entity_type = NEW.entity_type
       AND i.entity_id = NEW.entity_id
       AND i.state IN ('pending', 'approved')
       AND i.id <> NEW.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invalidate_sibling_action_request_items ON public.action_request_items;
CREATE TRIGGER invalidate_sibling_action_request_items
AFTER UPDATE OF state ON public.action_request_items
FOR EACH ROW EXECUTE FUNCTION public.invalidate_sibling_action_request_items();
