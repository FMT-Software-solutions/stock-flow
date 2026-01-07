-- Dashboard Stats RPCs (V2)
-- Updates:
-- 1. Remove branch filtering from Suppliers stats (they are org-wide).
-- 2. Add trend data to Sales and Expense stats for charts.
-- 3. Add trend data to Customer stats.

-- 1. Inventory Stats (Unchanged)
CREATE OR REPLACE FUNCTION get_inventory_stats(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_items BIGINT;
    v_low_stock_items BIGINT;
    v_out_of_stock_items BIGINT;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE quantity <= min_stock_level AND quantity > 0),
        COUNT(*) FILTER (WHERE quantity <= 0)
    INTO
        v_total_items,
        v_low_stock_items,
        v_out_of_stock_items
    FROM inventory
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND is_deleted = false;

    RETURN jsonb_build_object(
        'total_items', COALESCE(v_total_items, 0),
        'low_stock_items', COALESCE(v_low_stock_items, 0),
        'out_of_stock_items', COALESCE(v_out_of_stock_items, 0)
    );
END;
$$;

-- 2. Product Stats (Unchanged)
CREATE OR REPLACE FUNCTION get_product_stats(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL
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
    v_top_categories JSONB;
    v_least_categories JSONB;
BEGIN
    -- Basic counts are Org Wide
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
    AND is_deleted = false;

    -- Low/Out of stock (Branch dependent via inventory)
    SELECT COUNT(DISTINCT product_id)
    INTO v_low_stock_products
    FROM inventory
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND quantity <= min_stock_level AND quantity > 0
    AND is_deleted = false;

    SELECT COUNT(DISTINCT product_id)
    INTO v_out_of_stock_products
    FROM inventory
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND quantity <= 0
    AND is_deleted = false;

    -- Categories (Org Wide)
    SELECT jsonb_agg(t)
    INTO v_top_categories
    FROM (
        SELECT c.name as category, COUNT(p.id) as count
        FROM product_categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_deleted = false
        WHERE c.organization_id = p_organization_id
        GROUP BY c.id, c.name
        ORDER BY count DESC
        LIMIT 5
    ) t;

    SELECT jsonb_agg(t)
    INTO v_least_categories
    FROM (
        SELECT c.name as category, COUNT(p.id) as count
        FROM product_categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_deleted = false
        WHERE c.organization_id = p_organization_id
        GROUP BY c.id, c.name
        ORDER BY count ASC
        LIMIT 5
    ) t;

    RETURN jsonb_build_object(
        'total_products', COALESCE(v_total_products, 0),
        'active_products', COALESCE(v_active_products, 0),
        'inactive_products', COALESCE(v_inactive_products, 0),
        'low_stock_products', COALESCE(v_low_stock_products, 0),
        'out_of_stock_products', COALESCE(v_out_of_stock_products, 0),
        'top_categories', COALESCE(v_top_categories, '[]'::jsonb),
        'least_categories', COALESCE(v_least_categories, '[]'::jsonb)
    );
END;
$$;

-- 3. Sales Stats (Enhanced with Trend)
CREATE OR REPLACE FUNCTION get_sales_stats(
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
    v_owings NUMERIC;
    v_refunds NUMERIC;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Set defaults if dates are null (e.g. last 30 days for trend)
    v_start_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, NOW());
    
    SELECT
        COUNT(*),
        COALESCE(SUM(paid_amount), 0),
        COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE payment_status != 'refunded' AND payment_status != 'paid' AND status != 'cancelled'), 0),
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'refunded'), 0)
    INTO
        v_total_orders,
        v_total_revenue,
        v_owings,
        v_refunds
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

    -- Trend Data (Daily Revenue - Paid Amount)
    -- We select from generate_series to ensure we have entries for all days in the range
    -- Only for the requested range (or default last 30 days)
    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT 
            TO_CHAR(day, 'Mon DD') as date,
            COALESCE(SUM(o.paid_amount), 0) as value
        FROM generate_series(v_start_date, v_end_date, '1 day'::interval) as day
        LEFT JOIN orders o ON 
            o.organization_id = p_organization_id 
            AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
            AND o.date::date = day::date
            AND o.is_deleted = false
            -- We include all paid amounts regardless of order status (except maybe cancelled/refunded if paid_amount is 0'd out)
            -- Since we zero out paid_amount for refunded/unpaid, simple SUM(paid_amount) works.
        GROUP BY day
        ORDER BY day
    ) t;

    RETURN jsonb_build_object(
        'total_orders', COALESCE(v_total_orders, 0),
        'total_revenue', COALESCE(v_total_revenue, 0),
        'owings', COALESCE(v_owings, 0),
        'refunds', COALESCE(v_refunds, 0),
        'breakdown', COALESCE(v_breakdown, '{}'::jsonb),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

-- 4. Expense Stats (Enhanced with Trend)
CREATE OR REPLACE FUNCTION get_expense_stats(
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
    v_total_records BIGINT;
    v_total_expenditure NUMERIC;
    v_top_category JSONB;
    v_trend JSONB;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    v_start_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, NOW());

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

    SELECT jsonb_build_object('category', c.name, 'amount', SUM(e.amount))
    INTO v_top_category
    FROM expenses e
    JOIN expense_categories c ON e.category_id = c.id
    WHERE e.organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR e.branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR e.date >= p_start_date::date)
    AND (p_end_date IS NULL OR e.date <= p_end_date::date)
    AND e.status != 'rejected'
    AND e.is_deleted = false
    AND c.is_deleted = false
    GROUP BY c.id, c.name
    ORDER BY SUM(e.amount) DESC
    LIMIT 1;

    -- Trend Data (Daily Expenses)
    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT 
            TO_CHAR(day, 'Mon DD') as date,
            COALESCE(SUM(e.amount), 0) as value
        FROM generate_series(v_start_date, v_end_date, '1 day'::interval) as day
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
        'top_category', v_top_category,
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

-- 5. Customer Stats (Enhanced with Trend)
CREATE OR REPLACE FUNCTION get_customer_stats(
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
    v_total_customers BIGINT;
    v_new_this_period BIGINT;
    v_trend JSONB;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    v_start_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, NOW());

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

    -- Trend Data (Daily New Customers)
    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT 
            TO_CHAR(day, 'Mon DD') as date,
            COUNT(c.id) as value
        FROM generate_series(v_start_date, v_end_date, '1 day'::interval) as day
        LEFT JOIN customers c ON 
            c.organization_id = p_organization_id 
            AND c.created_at::date = day::date
            AND c.is_deleted = false
        GROUP BY day
        ORDER BY day
    ) t;

    RETURN jsonb_build_object(
        'total_customers', COALESCE(v_total_customers, 0),
        'new_this_period', COALESCE(v_new_this_period, 0),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

-- 6. Supplier Stats (Fixed: Removed branch filter)
CREATE OR REPLACE FUNCTION get_supplier_stats(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_suppliers BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_total_suppliers
    FROM suppliers
    WHERE organization_id = p_organization_id
    AND is_deleted = false;
    -- Removed branch filter as requested: "Suppliers are not restricted to branches"
    
    RETURN jsonb_build_object(
        'total_suppliers', COALESCE(v_total_suppliers, 0)
    );
END;
$$;

-- 7. User Stats (Unchanged)
CREATE OR REPLACE FUNCTION get_user_stats(
    p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_users BIGINT;
    v_active_users BIGINT;
    v_inactive_users BIGINT;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE is_active = true),
        COUNT(*) FILTER (WHERE is_active = false)
    INTO
        v_total_users,
        v_active_users,
        v_inactive_users
    FROM user_organizations
    WHERE organization_id = p_organization_id;

    RETURN jsonb_build_object(
        'total_users', COALESCE(v_total_users, 0),
        'active_users', COALESCE(v_active_users, 0),
        'inactive_users', COALESCE(v_inactive_users, 0)
    );
END;
$$;

-- 8. Branch Stats (Unchanged)
CREATE OR REPLACE FUNCTION get_branch_stats(
    p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_branches BIGINT;
    v_active_branches BIGINT;
    v_inactive_branches BIGINT;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE is_active = true),
        COUNT(*) FILTER (WHERE is_active = false)
    INTO
        v_total_branches,
        v_active_branches,
        v_inactive_branches
    FROM branches
    WHERE organization_id = p_organization_id
    AND is_deleted = false;

    RETURN jsonb_build_object(
        'total_branches', COALESCE(v_total_branches, 0),
        'active_branches', COALESCE(v_active_branches, 0),
        'inactive_branches', COALESCE(v_inactive_branches, 0)
    );
END;
$$;
