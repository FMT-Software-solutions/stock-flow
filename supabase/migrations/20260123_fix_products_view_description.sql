-- Fix products_view to include description column (was accidentally removed in soft delete migration)
-- We need to DROP the view first because we are changing column order/types which CREATE OR REPLACE doesn't support for existing views
DROP VIEW IF EXISTS public.products_view;

CREATE OR REPLACE VIEW public.products_view AS
SELECT
    p.id,
    p.name,
    p.sku,
    p.category_id,
    p.supplier_id,
    p.brand,
    p.cost_price,
    p.selling_price,
    p.unit,
    p.status,
    p.image_url,
    p.additional_images,
    p.tax_rate,
    p.barcode,
    p.discount,
    p.organization_id,
    p.created_at,
    p.updated_at,
    p.has_variations,
    p.is_deleted,
    p.description,
    pc.name as category_name,
    s.name as supplier_name,
    pr.first_name || ' ' || pr.last_name as created_by_name,
    COALESCE(SUM(i.quantity), 0) as quantity,
    COALESCE(MIN(i.min_stock_level), 0) as min_stock_level,
    MAX(i.location) as location
FROM
    products p
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN inventory i ON p.id = i.product_id AND i.is_deleted = FALSE
    LEFT JOIN profiles pr ON p.created_by = pr.id
GROUP BY
    p.id,
    pc.name,
    s.name,
    pr.first_name,
    pr.last_name,
    p.is_deleted,
    p.description;

GRANT SELECT ON public.products_view TO authenticated;
GRANT SELECT ON public.products_view TO service_role;
