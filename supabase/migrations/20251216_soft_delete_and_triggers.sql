-- Add is_deleted to products
ALTER TABLE products ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- Add is_deleted and deleted_by_product_deletion to inventory
ALTER TABLE inventory ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE inventory ADD COLUMN deleted_by_product_deletion BOOLEAN DEFAULT FALSE;

-- Create function for soft delete trigger
CREATE OR REPLACE FUNCTION handle_product_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- If product is being soft deleted
    IF NEW.is_deleted = TRUE AND OLD.is_deleted = FALSE THEN
        UPDATE inventory
        SET is_deleted = TRUE,
            deleted_by_product_deletion = TRUE
        WHERE product_id = NEW.id
        AND is_deleted = FALSE; -- Only update currently active inventory
    END IF;

    -- If product is being restored
    IF NEW.is_deleted = FALSE AND OLD.is_deleted = TRUE THEN
        UPDATE inventory
        SET is_deleted = FALSE,
            deleted_by_product_deletion = FALSE
        WHERE product_id = NEW.id
        AND deleted_by_product_deletion = TRUE; -- Only restore those deleted by cascade
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_product_soft_delete ON products;
CREATE TRIGGER on_product_soft_delete
    AFTER UPDATE OF is_deleted ON products
    FOR EACH ROW
    EXECUTE FUNCTION handle_product_soft_delete();

-- Update products_view to include is_deleted and filter inventory join
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
    p.is_deleted, -- Added column
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
    LEFT JOIN inventory i ON p.id = i.product_id AND i.is_deleted = FALSE -- Filter deleted inventory
    LEFT JOIN profiles pr ON p.created_by = pr.id
GROUP BY
    p.id,
    pc.name,
    s.name,
    pr.first_name,
    pr.last_name,
    p.is_deleted; -- Added to group by

GRANT SELECT ON public.products_view TO authenticated;
GRANT SELECT ON public.products_view TO service_role;
