CREATE OR REPLACE FUNCTION get_products_report(
    p_organization_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_products BIGINT;
    v_active_products BIGINT;
    v_inactive_products BIGINT;
    v_low_stock_products BIGINT;
    v_out_of_stock_products BIGINT;
    v_category_distribution JSONB;
    v_low_stock_list JSONB;
    v_out_of_stock_list JSONB;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'published'),
        COUNT(*) FILTER (WHERE status != 'published')
    INTO
        v_total_products,
        v_active_products,
        v_inactive_products
    FROM products
    WHERE organization_id = p_organization_id
    AND is_deleted = false
    AND (p_start_date IS NULL OR created_at::date >= p_start_date::date)
    AND (p_end_date IS NULL OR created_at::date <= p_end_date::date);

    SELECT COUNT(*)
    INTO v_low_stock_products
    FROM products_view pv
    WHERE pv.organization_id = p_organization_id
    AND pv.quantity <= pv.min_stock_level
    AND pv.quantity > 0
    AND (p_start_date IS NULL OR pv.created_at::date >= p_start_date::date)
    AND (p_end_date IS NULL OR pv.created_at::date <= p_end_date::date);

    SELECT COUNT(*)
    INTO v_out_of_stock_products
    FROM products_view pv
    WHERE pv.organization_id = p_organization_id
    AND pv.quantity <= 0
    AND (p_start_date IS NULL OR pv.created_at::date >= p_start_date::date)
    AND (p_end_date IS NULL OR pv.created_at::date <= p_end_date::date);

    SELECT jsonb_agg(t)
    INTO v_category_distribution
    FROM (
        SELECT c.name as category, COUNT(p.id) as count
        FROM product_categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_deleted = false
        WHERE c.organization_id = p_organization_id
        AND (p_start_date IS NULL OR p.created_at::date >= p_start_date::date)
        AND (p_end_date IS NULL OR p.created_at::date <= p_end_date::date)
        GROUP BY c.id, c.name
        ORDER BY count DESC
        LIMIT 10
    ) t;

    SELECT jsonb_agg(t)
    INTO v_low_stock_list
    FROM (
        SELECT 
            pv.id,
            pv.name,
            pv.sku,
            pv.category_name,
            pv.quantity,
            pv.min_stock_level
        FROM products_view pv
        WHERE pv.organization_id = p_organization_id
        AND pv.quantity <= pv.min_stock_level
        AND pv.quantity > 0
        AND (p_start_date IS NULL OR pv.created_at::date >= p_start_date::date)
        AND (p_end_date IS NULL OR pv.created_at::date <= p_end_date::date)
        ORDER BY pv.quantity ASC
        LIMIT 100
    ) t;

    SELECT jsonb_agg(t)
    INTO v_out_of_stock_list
    FROM (
        SELECT 
            pv.id,
            pv.name,
            pv.sku,
            pv.category_name,
            pv.quantity,
            pv.min_stock_level
        FROM products_view pv
        WHERE pv.organization_id = p_organization_id
        AND pv.quantity <= 0
        AND (p_start_date IS NULL OR pv.created_at::date >= p_start_date::date)
        AND (p_end_date IS NULL OR pv.created_at::date <= p_end_date::date)
        ORDER BY pv.quantity ASC
        LIMIT 100
    ) t;

    RETURN jsonb_build_object(
        'total_products', COALESCE(v_total_products, 0),
        'active_products', COALESCE(v_active_products, 0),
        'inactive_products', COALESCE(v_inactive_products, 0),
        'low_stock_products', COALESCE(v_low_stock_products, 0),
        'out_of_stock_products', COALESCE(v_out_of_stock_products, 0),
        'category_distribution', COALESCE(v_category_distribution, '[]'::jsonb),
        'low_stock_list', COALESCE(v_low_stock_list, '[]'::jsonb),
        'out_of_stock_list', COALESCE(v_out_of_stock_list, '[]'::jsonb)
    );
END;
$$;

-- Ensure no overloaded legacy signature remains (removes ambiguity in PostgREST)
DROP FUNCTION IF EXISTS public.get_inventory_report(
    UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT
);

CREATE OR REPLACE FUNCTION get_inventory_report(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_items BIGINT;
    v_low_stock_items BIGINT;
    v_out_of_stock_items BIGINT;
    v_stock_by_category JSONB;
    v_total_revenue NUMERIC;
    v_inventory_value_by_category JSONB;
    v_low_stock_list JSONB;
    v_out_of_stock_list JSONB;
BEGIN
    -- Total inventory entries
    SELECT COUNT(*)
    INTO v_total_items
    FROM inventory
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND is_deleted = false
    AND (p_start_date IS NULL OR last_updated >= p_start_date)
    AND (p_end_date IS NULL OR last_updated <= p_end_date);

    SELECT COUNT(*)
    INTO v_low_stock_items
    FROM inventory i
    WHERE i.organization_id = p_organization_id
    AND i.is_deleted = false
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR i.last_updated >= p_start_date)
    AND (p_end_date IS NULL OR i.last_updated <= p_end_date)
    AND COALESCE(i.quantity, 0) > 0
    AND COALESCE(i.quantity, 0) <= COALESCE(i.min_stock_level, 0);

    SELECT COUNT(*)
    INTO v_out_of_stock_items
    FROM inventory i
    WHERE i.organization_id = p_organization_id
    AND i.is_deleted = false
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR i.last_updated >= p_start_date)
    AND (p_end_date IS NULL OR i.last_updated <= p_end_date)
    AND COALESCE(i.quantity, 0) <= 0;

    SELECT jsonb_agg(t)
    INTO v_stock_by_category
    FROM (
        SELECT pc.name AS category, COALESCE(SUM(i.quantity), 0) AS quantity
        FROM inventory i
        LEFT JOIN products p ON p.id = i.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE i.organization_id = p_organization_id
        AND i.is_deleted = false
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
        AND (p_start_date IS NULL OR i.last_updated >= p_start_date)
        AND (p_end_date IS NULL OR i.last_updated <= p_end_date)
        GROUP BY pc.id, pc.name
        ORDER BY quantity DESC
        LIMIT 10
    ) t;

    SELECT COALESCE(SUM(i.quantity * COALESCE(i.price_override, p.selling_price)), 0)
    INTO v_total_revenue
    FROM inventory i
    LEFT JOIN products p ON p.id = i.product_id
    WHERE i.organization_id = p_organization_id
    AND i.is_deleted = false
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR i.last_updated >= p_start_date)
    AND (p_end_date IS NULL OR i.last_updated <= p_end_date);

    SELECT jsonb_agg(t)
    INTO v_inventory_value_by_category
    FROM (
        SELECT 
            pc.name AS category, 
            COALESCE(SUM(i.quantity * COALESCE(p.cost_price, 0)), 0) AS value
        FROM inventory i
        LEFT JOIN products p ON p.id = i.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE i.organization_id = p_organization_id
        AND i.is_deleted = false
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
        AND (p_start_date IS NULL OR i.last_updated >= p_start_date)
        AND (p_end_date IS NULL OR i.last_updated <= p_end_date)
        GROUP BY pc.id, pc.name
        ORDER BY value DESC
        LIMIT 10
    ) t;

    SELECT jsonb_agg(t)
    INTO v_low_stock_list
    FROM (
        SELECT 
            i.id AS id,
            COALESCE(p.name, COALESCE(i.custom_label, 'Unnamed Product')) AS name,
            COALESCE(p.sku, i.inventory_number) AS sku,
            COALESCE(pc.name, 'Uncategorized') AS category_name,
            COALESCE(i.quantity, 0) AS quantity,
            COALESCE(i.min_stock_level, 0) AS min_stock_level
        FROM inventory i
        LEFT JOIN products p ON p.id = i.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE i.organization_id = p_organization_id
        AND i.is_deleted = false
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
        AND (p_start_date IS NULL OR i.last_updated >= p_start_date)
        AND (p_end_date IS NULL OR i.last_updated <= p_end_date)
        AND COALESCE(i.quantity, 0) > 0
        AND COALESCE(i.quantity, 0) <= COALESCE(i.min_stock_level, 0)
        ORDER BY quantity ASC
        LIMIT 100
    ) t;

    SELECT jsonb_agg(t)
    INTO v_out_of_stock_list
    FROM (
        SELECT 
            i.id AS id,
            COALESCE(p.name, COALESCE(i.custom_label, 'Unnamed Product')) AS name,
            COALESCE(p.sku, i.inventory_number) AS sku,
            COALESCE(pc.name, 'Uncategorized') AS category_name,
            COALESCE(i.quantity, 0) AS quantity,
            COALESCE(i.min_stock_level, 0) AS min_stock_level
        FROM inventory i
        LEFT JOIN products p ON p.id = i.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE i.organization_id = p_organization_id
        AND i.is_deleted = false
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
        AND (p_start_date IS NULL OR i.last_updated >= p_start_date)
        AND (p_end_date IS NULL OR i.last_updated <= p_end_date)
        AND COALESCE(i.quantity, 0) <= 0
        ORDER BY quantity ASC
        LIMIT 100
    ) t;

    RETURN jsonb_build_object(
        'total_items', COALESCE(v_total_items, 0),
        'low_stock_items', COALESCE(v_low_stock_items, 0),
        'out_of_stock_items', COALESCE(v_out_of_stock_items, 0),
        'stock_by_category', COALESCE(v_stock_by_category, '[]'::jsonb),
        'total_revenue', COALESCE(v_total_revenue, 0),
        'inventory_value_by_category', COALESCE(v_inventory_value_by_category, '[]'::jsonb),
        'low_stock_list', COALESCE(v_low_stock_list, '[]'::jsonb),
        'out_of_stock_list', COALESCE(v_out_of_stock_list, '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_sales_report(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_orders BIGINT;
    v_total_revenue NUMERIC;
    v_breakdown JSONB;
    v_trend JSONB;
BEGIN
    SELECT
        COUNT(*),
        COALESCE(SUM(paid_amount), 0)
    INTO
        v_total_orders,
        v_total_revenue
    FROM orders
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date)
    AND is_deleted = false;

    SELECT jsonb_object_agg(status, count)
    INTO v_breakdown
    FROM (
        SELECT status, COUNT(*) as count
        FROM orders
        WHERE organization_id = p_organization_id
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
        AND (p_start_date IS NULL OR date >= p_start_date)
        AND (p_end_date IS NULL OR date <= p_end_date)
        AND is_deleted = false
        GROUP BY status
    ) t;

    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT 
            to_char(day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(o.paid_amount), 0) AS value
        FROM generate_series(
            COALESCE(p_start_date, NOW() - INTERVAL '30 days'),
            COALESCE(p_end_date, NOW()),
            '1 day'::interval
        ) AS day
        LEFT JOIN orders o ON 
            o.organization_id = p_organization_id 
            AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
            AND o.date::date = day::date
            AND o.is_deleted = false
        GROUP BY day
        ORDER BY day
    ) t;

    RETURN jsonb_build_object(
        'total_orders', COALESCE(v_total_orders, 0),
        'total_revenue', COALESCE(v_total_revenue, 0),
        'breakdown', COALESCE(v_breakdown, '{}'::jsonb),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_orders_report(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_orders BIGINT;
    v_breakdown JSONB;
BEGIN
    SELECT COUNT(*)
    INTO v_total_orders
    FROM orders
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date)
    AND is_deleted = false;

    SELECT jsonb_object_agg(status, count)
    INTO v_breakdown
    FROM (
        SELECT status, COUNT(*) as count
        FROM orders
        WHERE organization_id = p_organization_id
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
        AND (p_start_date IS NULL OR date >= p_start_date)
        AND (p_end_date IS NULL OR date <= p_end_date)
        AND is_deleted = false
        GROUP BY status
    ) t;

    RETURN jsonb_build_object(
        'total_orders', COALESCE(v_total_orders, 0),
        'breakdown', COALESCE(v_breakdown, '{}'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_expenses_report(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_group_by TEXT DEFAULT 'category'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_records BIGINT;
    v_total_expenditure NUMERIC;
    v_grouped JSONB;
    v_trend JSONB;
BEGIN
    SELECT
        COUNT(*),
        COALESCE(SUM(amount) FILTER (WHERE status != 'rejected'), 0)
    INTO
        v_total_records,
        v_total_expenditure
    FROM expenses
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR date >= p_start_date::date)
    AND (p_end_date IS NULL OR date <= p_end_date::date)
    AND is_deleted = false;

    IF lower(p_group_by) = 'type' THEN
        SELECT jsonb_agg(t)
        INTO v_grouped
        FROM (
            SELECT et.name AS name, COALESCE(SUM(e.amount), 0) AS amount
            FROM expenses e
            JOIN expense_types et ON e.type_id = et.id
            WHERE e.organization_id = p_organization_id
            AND e.status != 'rejected'
            AND e.is_deleted = false
            AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR e.branch_id = ANY(p_branch_ids))
            AND (p_start_date IS NULL OR e.date >= p_start_date::date)
            AND (p_end_date IS NULL OR e.date <= p_end_date::date)
            GROUP BY et.id, et.name
            ORDER BY amount DESC
            LIMIT 20
        ) t;
    ELSE
        SELECT jsonb_agg(t)
        INTO v_grouped
        FROM (
            SELECT ec.name AS name, COALESCE(SUM(e.amount), 0) AS amount
            FROM expenses e
            JOIN expense_categories ec ON e.category_id = ec.id
            WHERE e.organization_id = p_organization_id
            AND e.status != 'rejected'
            AND e.is_deleted = false
            AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR e.branch_id = ANY(p_branch_ids))
            AND (p_start_date IS NULL OR e.date >= p_start_date::date)
            AND (p_end_date IS NULL OR e.date <= p_end_date::date)
            GROUP BY ec.id, ec.name
            ORDER BY amount DESC
            LIMIT 20
        ) t;
    END IF;

    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT 
            to_char(day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(e.amount), 0) AS value
        FROM generate_series(
            COALESCE(p_start_date, NOW() - INTERVAL '30 days'),
            COALESCE(p_end_date, NOW()),
            '1 day'::interval
        ) AS day
        LEFT JOIN expenses e ON 
            e.organization_id = p_organization_id 
            AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR e.branch_id = ANY(p_branch_ids))
            AND e.status != 'rejected'
            AND e.date = day::date
            AND e.is_deleted = false
        GROUP BY day
        ORDER BY day
    ) t;

    RETURN jsonb_build_object(
        'total_records', COALESCE(v_total_records, 0),
        'total_expenditure', COALESCE(v_total_expenditure, 0),
        'grouped', COALESCE(v_grouped, '[]'::jsonb),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_customers_report(
    p_organization_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_customers BIGINT;
    v_new_this_period BIGINT;
    v_top_customers JSONB;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (
            WHERE (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
        )
    INTO
        v_total_customers,
        v_new_this_period
    FROM customers
    WHERE organization_id = p_organization_id
    AND is_deleted = false;

    SELECT jsonb_agg(t)
    INTO v_top_customers
    FROM (
        SELECT 
            COALESCE(c.first_name || ' ' || c.last_name, c.email) AS name,
            COALESCE(SUM(o.paid_amount), 0) AS total_spent,
            COUNT(o.id) AS orders_count
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
            AND o.organization_id = p_organization_id
            AND o.is_deleted = false
            AND (p_start_date IS NULL OR o.date >= p_start_date)
            AND (p_end_date IS NULL OR o.date <= p_end_date)
        WHERE c.organization_id = p_organization_id
        AND c.is_deleted = false
        GROUP BY c.id, c.first_name, c.last_name, c.email
        ORDER BY total_spent DESC
        LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'total_customers', COALESCE(v_total_customers, 0),
        'new_this_period', COALESCE(v_new_this_period, 0),
        'top_customers', COALESCE(v_top_customers, '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_suppliers_report(
    p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_suppliers BIGINT;
    v_top_suppliers JSONB;
BEGIN
    SELECT COUNT(*)
    INTO v_total_suppliers
    FROM suppliers
    WHERE organization_id = p_organization_id
    AND is_deleted = false;

    SELECT jsonb_agg(t)
    INTO v_top_suppliers
    FROM (
        SELECT s.name AS name, COUNT(p.id) AS product_count
        FROM suppliers s
        LEFT JOIN products p ON p.supplier_id = s.id AND p.is_deleted = false
        WHERE s.organization_id = p_organization_id
        AND s.is_deleted = false
        GROUP BY s.id, s.name
        ORDER BY product_count DESC
        LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'total_suppliers', COALESCE(v_total_suppliers, 0),
        'top_suppliers', COALESCE(v_top_suppliers, '[]'::jsonb)
    );
END;
$$;
