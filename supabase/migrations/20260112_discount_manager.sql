-- Create discounts table
CREATE TABLE IF NOT EXISTS public.discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value NUMERIC(10,2) NOT NULL,
    start_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    customer_ids UUID[], -- Array of specific customer UUIDs, null/empty means all
    branch_ids UUID[], -- Array of specific branch UUIDs, null/empty means all (used for rule validation)
    target_mode TEXT CHECK (target_mode IN ('all','category','product','inventory')),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add discount_id to inventory
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES public.discounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_discount_id ON public.inventory(discount_id);

-- -- Enable RLS
-- ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- -- RLS Policy
-- CREATE POLICY "Users can access their organization's discounts" ON public.discounts
--     USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- RPC to manage discounts
CREATE OR REPLACE FUNCTION public.manage_inventory_discount(
    p_organization_id UUID,
    p_action TEXT, -- 'apply', 'remove'
    p_discount JSONB, -- { id?, name, code, type, value, start_at, expires_at, customer_ids, branch_ids }
    p_targets JSONB -- { apply_to_all: bool, inventory_ids: [], product_ids: [], category_ids: [], target_branch_ids: [] }
) RETURNS JSONB AS $$
DECLARE
    v_discount_id UUID;
    v_target_branch_ids UUID[];
    v_target_mode TEXT;
BEGIN
    -- 1. Handle Discount Record (Upsert if apply)
    IF p_action = 'apply' THEN
        IF (p_discount->>'id') IS NOT NULL THEN
            UPDATE public.discounts SET
                name = p_discount->>'name',
                code = p_discount->>'code',
                description = p_discount->>'description',
                type = p_discount->>'type',
                value = (p_discount->>'value')::numeric,
                start_at = (p_discount->>'start_at')::timestamptz,
                expires_at = (p_discount->>'expires_at')::timestamptz,
                customer_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'customer_ids') t(x)),
                branch_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'branch_ids') t(x)),
                usage_mode = COALESCE(p_discount->>'usage_mode', usage_mode),
                usage_limit = CASE WHEN (p_discount->>'usage_limit') IS NULL THEN usage_limit ELSE (p_discount->>'usage_limit')::int END,
                updated_at = now()
            WHERE id = (p_discount->>'id')::uuid
            RETURNING id INTO v_discount_id;
        ELSE
            INSERT INTO public.discounts (
                organization_id, name, code, description, type, value, start_at, expires_at, customer_ids, branch_ids, usage_mode, usage_limit, created_by
            ) VALUES (
                p_organization_id,
                p_discount->>'name',
                p_discount->>'code',
                p_discount->>'description',
                p_discount->>'type',
                (p_discount->>'value')::numeric,
                (p_discount->>'start_at')::timestamptz,
                (p_discount->>'expires_at')::timestamptz,
                (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'customer_ids') t(x)),
                (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'branch_ids') t(x)),
                COALESCE(p_discount->>'usage_mode','manual'),
                CASE WHEN (p_discount->>'usage_limit') IS NULL THEN NULL ELSE (p_discount->>'usage_limit')::int END,
                auth.uid()
            ) RETURNING id INTO v_discount_id;
        END IF;
    END IF;

    -- Determine target_mode from p_targets
    IF p_targets IS NOT NULL THEN
        IF (p_targets->>'apply_to_all') = 'true' THEN
            v_target_mode := 'all';
        ELSIF (p_targets->'category_ids' IS NOT NULL AND jsonb_array_length(p_targets->'category_ids') > 0) THEN
            v_target_mode := 'category';
        ELSIF (p_targets->'product_ids' IS NOT NULL AND jsonb_array_length(p_targets->'product_ids') > 0) THEN
            v_target_mode := 'product';
        ELSIF (p_targets->'inventory_ids' IS NOT NULL AND jsonb_array_length(p_targets->'inventory_ids') > 0) THEN
            v_target_mode := 'inventory';
        ELSE
            v_target_mode := NULL;
        END IF;
    END IF;

    -- 2. Handle Discount Record (Upsert target_mode when apply)
    IF p_action = 'apply' THEN
        IF (p_discount->>'id') IS NOT NULL THEN
            UPDATE public.discounts SET
                name = p_discount->>'name',
                code = p_discount->>'code',
                description = p_discount->>'description',
                type = p_discount->>'type',
                value = (p_discount->>'value')::numeric,
                start_at = (p_discount->>'start_at')::timestamptz,
                expires_at = (p_discount->>'expires_at')::timestamptz,
                customer_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'customer_ids') t(x)),
                branch_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'branch_ids') t(x)),
                target_mode = v_target_mode,
                usage_mode = COALESCE(p_discount->>'usage_mode', usage_mode),
                usage_limit = CASE WHEN (p_discount->>'usage_limit') IS NULL THEN usage_limit ELSE (p_discount->>'usage_limit')::int END,
                updated_at = now()
            WHERE id = (p_discount->>'id')::uuid
            RETURNING id INTO v_discount_id;
        ELSE
            INSERT INTO public.discounts (
                organization_id, name, code, description, type, value, start_at, expires_at, customer_ids, branch_ids, target_mode, usage_mode, usage_limit, created_by
            ) VALUES (
                p_organization_id,
                p_discount->>'name',
                p_discount->>'code',
                p_discount->>'description',
                p_discount->>'type',
                (p_discount->>'value')::numeric,
                (p_discount->>'start_at')::timestamptz,
                (p_discount->>'expires_at')::timestamptz,
                (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'customer_ids') t(x)),
                (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'branch_ids') t(x)),
                v_target_mode,
                COALESCE(p_discount->>'usage_mode','manual'),
                CASE WHEN (p_discount->>'usage_limit') IS NULL THEN NULL ELSE (p_discount->>'usage_limit')::int END,
                auth.uid()
            ) RETURNING id INTO v_discount_id;
        END IF;
    END IF;

    IF p_action = 'apply' AND v_discount_id IS NOT NULL THEN
        UPDATE public.inventory
        SET discount_id = NULL,
            last_updated = now()
        WHERE organization_id = p_organization_id
          AND discount_id = v_discount_id;
    END IF;

    -- 3. Update Inventory
    v_target_branch_ids := (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_targets->'target_branch_ids') t(x));

    IF p_targets IS NOT NULL THEN
        UPDATE public.inventory i
        SET discount_id = CASE WHEN p_action = 'apply' THEN v_discount_id ELSE NULL END,
            last_updated = now()
        FROM public.products p
        WHERE i.product_id = p.id
        AND i.organization_id = p_organization_id
        AND (
            (p_targets->>'apply_to_all' = 'true')
            OR
            -- Match specific Inventory IDs
            (p_targets->'inventory_ids' IS NOT NULL AND jsonb_array_length(p_targets->'inventory_ids') > 0 AND i.id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'inventory_ids') t(x)))
            OR
            -- Match Product IDs
            (p_targets->'product_ids' IS NOT NULL AND jsonb_array_length(p_targets->'product_ids') > 0 AND i.product_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'product_ids') t(x)))
            OR
            -- Match Category IDs
            (p_targets->'category_ids' IS NOT NULL AND jsonb_array_length(p_targets->'category_ids') > 0 AND p.category_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'category_ids') t(x)))
        )
        AND (
            v_target_branch_ids IS NULL 
            OR array_length(v_target_branch_ids, 1) IS NULL 
            OR i.branch_id = ANY(v_target_branch_ids)
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'discount_id', v_discount_id);
END;
$$ LANGUAGE plpgsql;
