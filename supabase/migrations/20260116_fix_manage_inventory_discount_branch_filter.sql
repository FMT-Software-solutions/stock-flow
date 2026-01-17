CREATE OR REPLACE FUNCTION public.manage_inventory_discount(
    p_organization_id UUID,
    p_action TEXT,
    p_discount JSONB,
    p_targets JSONB
) RETURNS JSONB AS $$
DECLARE
    v_discount_id UUID;
    v_target_mode TEXT;
    v_applied_count BIGINT := 0;
    v_target_branch_ids UUID[];
BEGIN
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
                customer_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p_discount->'customer_ids', '[]'::jsonb)) t(x)),
                branch_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p_discount->'branch_ids', '[]'::jsonb)) t(x)),
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
                (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p_discount->'customer_ids', '[]'::jsonb)) t(x)),
                (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p_discount->'branch_ids', '[]'::jsonb)) t(x)),
                COALESCE(p_discount->>'usage_mode','manual'),
                CASE WHEN (p_discount->>'usage_limit') IS NULL THEN NULL ELSE (p_discount->>'usage_limit')::int END,
                auth.uid()
            ) RETURNING id INTO v_discount_id;
        END IF;
    ELSE
        v_discount_id := (p_discount->>'id')::uuid;
    END IF;

    v_target_branch_ids := (
        SELECT array_agg(x::uuid)
        FROM jsonb_array_elements_text(COALESCE(p_targets->'target_branch_ids', '[]'::jsonb)) t(x)
    );

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

    IF p_action = 'apply' AND v_discount_id IS NOT NULL THEN
        UPDATE public.discounts
        SET target_mode = v_target_mode,
            updated_at = now()
        WHERE id = v_discount_id;
    END IF;

    IF p_action = 'apply' AND v_discount_id IS NOT NULL THEN
        DELETE FROM public.inventory_discounts
        WHERE organization_id = p_organization_id
          AND discount_id = v_discount_id;
    END IF;

    IF v_discount_id IS NOT NULL THEN
        IF p_action = 'apply' THEN
            INSERT INTO public.inventory_discounts (organization_id, inventory_id, discount_id, branch_id)
            SELECT p_organization_id, i.id, v_discount_id, i.branch_id
            FROM public.inventory i
            JOIN public.products p ON p.id = i.product_id
            WHERE i.organization_id = p_organization_id
              AND i.is_deleted = false
              AND (
                (p_targets->>'apply_to_all' = 'true')
                OR (p_targets->'inventory_ids' IS NOT NULL AND jsonb_array_length(p_targets->'inventory_ids') > 0 AND i.id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'inventory_ids') t(x)))
                OR (p_targets->'product_ids' IS NOT NULL AND jsonb_array_length(p_targets->'product_ids') > 0 AND i.product_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'product_ids') t(x)))
                OR (p_targets->'category_ids' IS NOT NULL AND jsonb_array_length(p_targets->'category_ids') > 0 AND p.category_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'category_ids') t(x)))
              )
              AND (
                v_target_branch_ids IS NULL
                OR array_length(v_target_branch_ids, 1) IS NULL
                OR i.branch_id = ANY(v_target_branch_ids)
              )
            ON CONFLICT (inventory_id, discount_id) DO NOTHING;
            GET DIAGNOSTICS v_applied_count = ROW_COUNT;
        ELSIF p_action = 'remove' THEN
            DELETE FROM public.inventory_discounts idj
            USING public.inventory i, public.products p
            WHERE idj.organization_id = p_organization_id
              AND idj.discount_id = v_discount_id
              AND idj.inventory_id = i.id
              AND i.product_id = p.id
              AND i.organization_id = p_organization_id
              AND i.is_deleted = false
              AND (
                (p_targets->>'apply_to_all' = 'true')
                OR (p_targets->'inventory_ids' IS NOT NULL AND jsonb_array_length(p_targets->'inventory_ids') > 0 AND i.id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'inventory_ids') t(x)))
                OR (p_targets->'product_ids' IS NOT NULL AND jsonb_array_length(p_targets->'product_ids') > 0 AND i.product_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'product_ids') t(x)))
                OR (p_targets->'category_ids' IS NOT NULL AND jsonb_array_length(p_targets->'category_ids') > 0 AND p.category_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'category_ids') t(x)))
              )
              AND (
                v_target_branch_ids IS NULL
                OR array_length(v_target_branch_ids, 1) IS NULL
                OR i.branch_id = ANY(v_target_branch_ids)
              );
            GET DIAGNOSTICS v_applied_count = ROW_COUNT;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'discount_id', v_discount_id,
        'target_mode', v_target_mode,
        'affected_count', COALESCE(v_applied_count, 0)
    );
END;
$$ LANGUAGE plpgsql;

