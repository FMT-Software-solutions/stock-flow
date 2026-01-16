ALTER TABLE public.discounts
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

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
                customer_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'customer_ids') t(x)),
                branch_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_discount->'branch_ids') t(x)),
                usage_mode = COALESCE(p_discount->>'usage_mode', usage_mode),
                usage_limit = CASE WHEN (p_discount->>'usage_limit') IS NULL THEN usage_limit ELSE (p_discount->>'usage_limit')::int END,
                created_by = COALESCE((p_discount->>'created_by')::uuid, created_by),
                updated_by = auth.uid(),
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
                COALESCE((p_discount->>'created_by')::uuid, auth.uid())
            ) RETURNING id INTO v_discount_id;
        END IF;
    ELSE
        v_discount_id := (p_discount->>'id')::uuid;
    END IF;

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
            updated_by = auth.uid(),
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
                OR (p_targets->'target_branch_ids' IS NOT NULL AND jsonb_array_length(p_targets->'target_branch_ids') > 0 AND i.branch_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'target_branch_ids') t(x)))
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
              AND (
                (p_targets->>'apply_to_all' = 'true')
                OR (p_targets->'inventory_ids' IS NOT NULL AND jsonb_array_length(p_targets->'inventory_ids') > 0 AND i.id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'inventory_ids') t(x)))
                OR (p_targets->'product_ids' IS NOT NULL AND jsonb_array_length(p_targets->'product_ids') > 0 AND i.product_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'product_ids') t(x)))
                OR (p_targets->'category_ids' IS NOT NULL AND jsonb_array_length(p_targets->'category_ids') > 0 AND p.category_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'category_ids') t(x)))
                OR (p_targets->'target_branch_ids' IS NOT NULL AND jsonb_array_length(p_targets->'target_branch_ids') > 0 AND i.branch_id IN (SELECT x::uuid FROM jsonb_array_elements_text(p_targets->'target_branch_ids') t(x)))
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

CREATE OR REPLACE FUNCTION public.get_discount_details(
    p_organization_id UUID,
    p_discount_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_discount JSONB;
    v_inventories JSONB;
BEGIN
    SELECT to_jsonb(d)
    INTO v_discount
    FROM (
        SELECT 
            id,
            organization_id,
            name,
            code,
            description,
            type,
            value,
            start_at,
            expires_at,
            customer_ids,
            branch_ids,
            target_mode,
            usage_mode,
            usage_limit,
            times_used,
            is_active,
            created_by,
            updated_by,
            created_at,
            updated_at
        FROM public.discounts
        WHERE id = p_discount_id AND organization_id = p_organization_id
    ) d;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.last_updated DESC), '[]'::jsonb)
    INTO v_inventories
    FROM (
        SELECT 
            i.id,
            i.inventory_number,
            i.product_id,
            i.variant_id,
            i.branch_id,
            i.quantity,
            i.min_stock_level,
            i.location,
            i.organization_id,
            i.last_updated,
            i.custom_label,
            i.price_override,
            i.type,
            i.image_url,
            p.name AS product_name,
            p.sku AS product_sku,
            p.unit AS product_unit,
            p.selling_price AS product_price,
            p.image_url AS product_image,
            p.status AS product_status,
            v.sku AS variant_sku,
            v.price AS variant_price,
            v.attributes AS variant_attributes,
            b.name AS branch_name
        FROM public.inventory i
        JOIN public.inventory_discounts idj ON idj.inventory_id = i.id
        LEFT JOIN public.products p ON p.id = i.product_id
        LEFT JOIN public.product_variants v ON v.id = i.variant_id
        LEFT JOIN public.branches b ON b.id = i.branch_id
        WHERE i.organization_id = p_organization_id
          AND idj.discount_id = p_discount_id
          AND i.is_deleted = false
    ) t;

    RETURN jsonb_build_object(
        'discount', v_discount,
        'inventories', v_inventories
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_valid_inventory_discounts(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(res)), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT 
            i.id AS inventory_id,
            i.product_id,
            i.variant_id,
            i.branch_id,
            COALESCE(
                (
                    SELECT jsonb_agg(to_jsonb(drow) ORDER BY drow.created_at DESC)
                    FROM (
                        SELECT 
                            d.id,
                            d.organization_id,
                            d.name,
                            d.code,
                            d.description,
                            d.type,
                            d.value,
                            d.start_at,
                            d.expires_at,
                            d.customer_ids,
                            d.branch_ids,
                            d.target_mode,
                            d.usage_mode,
                            d.usage_limit,
                            d.times_used,
                            d.is_active,
                            d.created_by,
                            d.updated_by,
                            d.created_at,
                            d.updated_at
                        FROM public.inventory_discounts idj
                        JOIN public.discounts d ON d.id = idj.discount_id
                        WHERE idj.inventory_id = i.id
                          AND d.organization_id = p_organization_id
                          AND d.is_active = true
                          AND (d.start_at IS NULL OR d.start_at <= now())
                          AND (d.expires_at IS NULL OR d.expires_at >= now())
                          AND (d.usage_limit IS NULL OR d.times_used < d.usage_limit)
                    ) drow
                ),
                '[]'::jsonb
            ) AS discounts
        FROM public.inventory i
        WHERE i.organization_id = p_organization_id
          AND i.is_deleted = false
          AND (
            p_branch_ids IS NULL
            OR cardinality(p_branch_ids) = 0
            OR i.branch_id = ANY(p_branch_ids)
          )
    ) res;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
