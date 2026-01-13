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
            is_active,
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
        LEFT JOIN public.products p ON p.id = i.product_id
        LEFT JOIN public.product_variants v ON v.id = i.variant_id
        LEFT JOIN public.branches b ON b.id = i.branch_id
        WHERE i.organization_id = p_organization_id
          AND i.discount_id = p_discount_id
          AND i.is_deleted = false
    ) t;

    RETURN jsonb_build_object(
        'discount', v_discount,
        'inventories', v_inventories
    );
END;
$$ LANGUAGE plpgsql;

