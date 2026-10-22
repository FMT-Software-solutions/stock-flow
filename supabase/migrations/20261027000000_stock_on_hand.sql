-- Stock on hand (v1.1.7)
--
-- The Reports page merges the Products and Inventory reports into one
-- "Stock on hand" report. get_inventory_report (as defined in
-- 20261026000000_reports_refresh.sql) now also rolls stock up per product
-- for the selected branches, so the page can list low / out-of-stock
-- products as well as individual stock items. Tracked products that were
-- never stocked count as out of stock. Same signature; new keys only.

CREATE OR REPLACE FUNCTION get_inventory_report(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_totals RECORD;
    v_stock_by_category JSONB;
    v_value_by_category JSONB;
    v_low_list JSONB;
    v_out_list JSONB;
    v_product_counts RECORD;
    v_product_low_list JSONB;
    v_product_out_list JSONB;
BEGIN
    PERFORM public.assert_org_member(p_organization_id);

    CREATE TEMP TABLE IF NOT EXISTS _report_rows (
        id UUID, name TEXT, variant TEXT, label TEXT, branch_name TEXT, sku TEXT,
        category_name TEXT, quantity NUMERIC, min_stock_level NUMERIC,
        unit_price NUMERIC, unit_cost NUMERIC
    ) ON COMMIT DROP;
    TRUNCATE _report_rows;

    INSERT INTO _report_rows
    SELECT
        i.id,
        p.name,
        public.variant_display_name(v.attributes),
        NULLIF(i.custom_label, ''),
        b.name,
        COALESCE(v.sku, p.sku, i.inventory_number),
        COALESCE(pc.name, 'Uncategorized'),
        COALESCE(i.quantity, 0),
        COALESCE(i.min_stock_level, 0),
        COALESCE(i.price_override, v.price, p.selling_price, 0),
        COALESCE(p.cost_price, 0)
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    LEFT JOIN product_variants v ON v.id = i.variant_id
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN branches b ON b.id = i.branch_id
    WHERE i.organization_id = p_organization_id
      AND i.is_deleted = false
      AND i.branch_id IS NOT NULL
      AND p.is_deleted = false
      AND p.track_stock = true
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids));

    SELECT
        COUNT(*) AS total_items,
        COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= min_stock_level) AS low,
        COUNT(*) FILTER (WHERE quantity <= 0) AS out_count,
        COALESCE(SUM(quantity * unit_price) FILTER (WHERE quantity > 0), 0) AS retail_value,
        COALESCE(SUM(quantity * unit_cost) FILTER (WHERE quantity > 0), 0) AS cost_value
    INTO v_totals
    FROM _report_rows;

    SELECT jsonb_agg(t) INTO v_stock_by_category FROM (
        SELECT category_name AS category, SUM(quantity) AS quantity
        FROM _report_rows GROUP BY category_name
        ORDER BY quantity DESC LIMIT 10
    ) t;

    SELECT jsonb_agg(t) INTO v_value_by_category FROM (
        SELECT category_name AS category,
               COALESCE(SUM(quantity * unit_cost) FILTER (WHERE quantity > 0), 0) AS value
        FROM _report_rows GROUP BY category_name
        ORDER BY value DESC LIMIT 10
    ) t;

    SELECT jsonb_agg(t) INTO v_low_list FROM (
        SELECT id, name, variant, label, branch_name, sku, category_name, quantity, min_stock_level
        FROM _report_rows
        WHERE quantity > 0 AND quantity <= min_stock_level
        ORDER BY quantity ASC, name LIMIT 100
    ) t;

    SELECT jsonb_agg(t) INTO v_out_list FROM (
        SELECT id, name, variant, label, branch_name, sku, category_name, quantity, min_stock_level
        FROM _report_rows
        WHERE quantity <= 0
        ORDER BY quantity ASC, name LIMIT 100
    ) t;

    -- Per product across the selected branches. Tracked, existing products
    -- with no stock rows count as out of stock (never stocked).
    CREATE TEMP TABLE IF NOT EXISTS _report_products (
        id UUID, name TEXT, sku TEXT, category_name TEXT,
        quantity NUMERIC, min_stock_level NUMERIC
    ) ON COMMIT DROP;
    TRUNCATE _report_products;

    INSERT INTO _report_products
    SELECT
        p.id, p.name, p.sku, COALESCE(pc.name, 'Uncategorized'),
        COALESCE(SUM(r.quantity), 0),
        COALESCE(SUM(r.min_stock_level), 0)
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN inventory i ON i.product_id = p.id
    LEFT JOIN _report_rows r ON r.id = i.id
    WHERE p.organization_id = p_organization_id
      AND p.is_deleted = false
      AND p.track_stock = true
    GROUP BY p.id, p.name, p.sku, pc.name;

    SELECT
        COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= min_stock_level) AS low,
        COUNT(*) FILTER (WHERE quantity <= 0) AS out_count
    INTO v_product_counts
    FROM _report_products;

    SELECT jsonb_agg(t) INTO v_product_low_list FROM (
        SELECT * FROM _report_products
        WHERE quantity > 0 AND quantity <= min_stock_level
        ORDER BY quantity ASC, name LIMIT 100
    ) t;

    SELECT jsonb_agg(t) INTO v_product_out_list FROM (
        SELECT * FROM _report_products
        WHERE quantity <= 0
        ORDER BY name LIMIT 200
    ) t;

    RETURN jsonb_build_object(
        'total_items', COALESCE(v_totals.total_items, 0),
        'low_stock_items', COALESCE(v_totals.low, 0),
        'out_of_stock_items', COALESCE(v_totals.out_count, 0),
        'stock_by_category', COALESCE(v_stock_by_category, '[]'::jsonb),
        -- value at selling price (name kept for older app versions)
        'total_revenue', COALESCE(v_totals.retail_value, 0),
        'total_cost', COALESCE(v_totals.cost_value, 0),
        'inventory_value_by_category', COALESCE(v_value_by_category, '[]'::jsonb),
        'low_stock_list', COALESCE(v_low_list, '[]'::jsonb),
        'out_of_stock_list', COALESCE(v_out_list, '[]'::jsonb),
        'low_stock_products', COALESCE(v_product_counts.low, 0),
        'out_of_stock_products', COALESCE(v_product_counts.out_count, 0),
        'product_low_stock_list', COALESCE(v_product_low_list, '[]'::jsonb),
        'product_out_of_stock_list', COALESCE(v_product_out_list, '[]'::jsonb)
    );
END;
$$;
