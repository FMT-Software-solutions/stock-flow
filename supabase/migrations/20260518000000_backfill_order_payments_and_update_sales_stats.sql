-- Migration: Backfill order_payments and Update Sales Stats RPC

-- 1. Backfill historical order payments for orders created before May 17, 2026
INSERT INTO public.order_payments (
    order_id,
    organization_id,
    amount,
    payment_method,
    notes,
    created_at,
    created_by
)
SELECT 
    id as order_id,
    organization_id,
    paid_amount as amount,
    payment_method,
    'Historical backfill payment' as notes,
    COALESCE(date, created_at) as created_at,
    created_by
FROM public.orders
WHERE paid_amount > 0 
  AND created_at < '2026-05-17 00:00:00+00'
  AND id NOT IN (SELECT order_id FROM public.order_payments);


-- 2. Update get_sales_stats RPC to use order_payments for Revenue Collected
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
    v_gross_sales NUMERIC;
    v_revenue_collected NUMERIC;
    v_revenue_from_previous_sales NUMERIC;
    v_revenue_from_current_sales NUMERIC;
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
    
    -- Gross Sales & Orders (Based on Orders Table)
    SELECT
        COUNT(*),
        COALESCE(SUM(total_amount), 0),
        COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE payment_status != 'refunded' AND payment_status != 'paid' AND status != 'cancelled'), 0),
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'refunded'), 0)
    INTO
        v_total_orders,
        v_gross_sales,
        v_owings,
        v_refunds
    FROM orders
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date)
    AND is_deleted = false;

    -- Revenue Collected (Based on order_payments Table)
    SELECT
        COALESCE(SUM(op.amount), 0),
        COALESCE(SUM(op.amount) FILTER (WHERE p_start_date IS NOT NULL AND o.date < p_start_date), 0),
        COALESCE(SUM(op.amount) FILTER (WHERE p_start_date IS NULL OR o.date >= p_start_date), 0)
    INTO
        v_revenue_collected,
        v_revenue_from_previous_sales,
        v_revenue_from_current_sales
    FROM order_payments op
    JOIN orders o ON op.order_id = o.id
    WHERE op.organization_id = p_organization_id
    AND o.is_deleted = false
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR op.created_at >= p_start_date)
    AND (p_end_date IS NULL OR op.created_at <= p_end_date);

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

    -- Ensure breakdown is at least an empty object if no orders exist
    IF v_breakdown IS NULL THEN
        v_breakdown := '{}'::jsonb;
    END IF;

    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT 
            TO_CHAR(day, 'Mon DD') as date,
            COALESCE(SUM(op.amount), 0) as value
        FROM generate_series(v_start_date, v_end_date, '1 day'::interval) as day
        LEFT JOIN (
            SELECT p.created_at, p.amount 
            FROM order_payments p
            JOIN orders ord ON p.order_id = ord.id
            WHERE p.organization_id = p_organization_id
              AND ord.is_deleted = false
              AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR ord.branch_id = ANY(p_branch_ids))
        ) op ON op.created_at::date = day::date
        GROUP BY day
        ORDER BY day
    ) t;

    RETURN jsonb_build_object(
        'total_orders', COALESCE(v_total_orders, 0),
        'gross_sales', COALESCE(v_gross_sales, 0),
        'total_revenue', COALESCE(v_revenue_collected, 0), -- Kept for backward compatibility
        'revenue_collected', COALESCE(v_revenue_collected, 0),
        'revenue_from_previous_sales', COALESCE(v_revenue_from_previous_sales, 0),
        'revenue_from_current_sales', COALESCE(v_revenue_from_current_sales, 0),
        'owings', COALESCE(v_owings, 0),
        'refunds', COALESCE(v_refunds, 0),
        'breakdown', COALESCE(v_breakdown, '{}'::jsonb),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

-- 3. Update get_sales_report RPC
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
    v_gross_sales NUMERIC;
    v_revenue_collected NUMERIC;
    v_revenue_from_previous_sales NUMERIC;
    v_revenue_from_current_sales NUMERIC;
    v_breakdown JSONB;
    v_trend JSONB;
BEGIN
    SELECT
        COUNT(*),
        COALESCE(SUM(total_amount), 0)
    INTO
        v_total_orders,
        v_gross_sales
    FROM orders
    WHERE organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date)
    AND is_deleted = false;

    -- Calculate Revenue Collected strictly from order_payments
    SELECT 
        COALESCE(SUM(amount), 0)
    INTO 
        v_revenue_collected
    FROM order_payments op
    JOIN orders o ON op.order_id = o.id
    WHERE o.organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR op.created_at >= p_start_date)
    AND (p_end_date IS NULL OR op.created_at <= p_end_date)
    AND o.is_deleted = false;

    -- Breakdown Revenue by Current Sales vs Previous Sales
    SELECT 
        COALESCE(SUM(op.amount) FILTER (WHERE o.date >= p_start_date), 0),
        COALESCE(SUM(op.amount) FILTER (WHERE p_start_date IS NOT NULL AND o.date < p_start_date), 0)
    INTO
        v_revenue_from_current_sales,
        v_revenue_from_previous_sales
    FROM order_payments op
    JOIN orders o ON op.order_id = o.id
    WHERE o.organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR op.created_at >= p_start_date)
    AND (p_end_date IS NULL OR op.created_at <= p_end_date)
    AND o.is_deleted = false;

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

    -- Ensure breakdown is at least an empty object if no orders exist
    IF v_breakdown IS NULL THEN
        v_breakdown := '{}'::jsonb;
    END IF;

    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT 
            to_char(day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(op.amount), 0) AS value
        FROM generate_series(
            COALESCE(p_start_date, NOW() - INTERVAL '30 days'),
            COALESCE(p_end_date, NOW()),
            '1 day'::interval
        ) AS day
        LEFT JOIN (
            SELECT p.created_at, p.amount 
            FROM order_payments p
            JOIN orders ord ON p.order_id = ord.id
            WHERE p.organization_id = p_organization_id
              AND ord.is_deleted = false
              AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR ord.branch_id = ANY(p_branch_ids))
        ) op ON op.created_at::date = day::date
        GROUP BY day
        ORDER BY day
    ) t;

    RETURN jsonb_build_object(
        'total_orders', COALESCE(v_total_orders, 0),
        'gross_sales', COALESCE(v_gross_sales, 0),
        'total_revenue', COALESCE(v_revenue_collected, 0),
        'revenue_collected', COALESCE(v_revenue_collected, 0),
        'revenue_from_previous_sales', COALESCE(v_revenue_from_previous_sales, 0),
        'revenue_from_current_sales', COALESCE(v_revenue_from_current_sales, 0),
        'breakdown', COALESCE(v_breakdown, '{}'::jsonb),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

-- 4. Update get_customers_report RPC
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
    v_new_this_month BIGINT;
    v_top_customers JSONB;
    v_customers_owing JSONB;
BEGIN
    SELECT COUNT(*)
    INTO v_total_customers
    FROM customers
    WHERE organization_id = p_organization_id
      AND is_deleted = false;

    SELECT COUNT(*)
    INTO v_new_this_month
    FROM customers
    WHERE organization_id = p_organization_id
      AND is_deleted = false
      AND created_at >= date_trunc('month', NOW())
      AND created_at < date_trunc('month', NOW()) + interval '1 month';

    SELECT jsonb_agg(t)
    INTO v_top_customers
    FROM (
        SELECT 
            c.id AS customer_id,
            COALESCE(NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''), c.email, 'Unknown') AS name,
            COALESCE((
                SELECT SUM(op.amount)
                FROM order_payments op
                JOIN orders o2 ON o2.id = op.order_id
                WHERE o2.customer_id = c.id
                  AND op.organization_id = p_organization_id
                  AND o2.is_deleted = false
                  AND (p_start_date IS NULL OR op.created_at >= p_start_date)
                  AND (p_end_date IS NULL OR op.created_at <= p_end_date)
            ), 0) AS total_spent,
            (
                SELECT COUNT(o3.id)
                FROM orders o3
                WHERE o3.customer_id = c.id
                  AND o3.organization_id = p_organization_id
                  AND o3.is_deleted = false
                  AND (p_start_date IS NULL OR o3.date >= p_start_date)
                  AND (p_end_date IS NULL OR o3.date <= p_end_date)
            ) AS orders_count
        FROM customers c
        WHERE c.organization_id = p_organization_id
          AND c.is_deleted = false
        ORDER BY total_spent DESC
        LIMIT 10
    ) t;

    SELECT jsonb_agg(t)
    INTO v_customers_owing
    FROM (
        SELECT 
            c.id AS customer_id,
            COALESCE(NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''), c.email, 'Unknown') AS name,
            COALESCE(SUM(GREATEST(o.total_amount - o.paid_amount, 0)), 0) AS total_owing,
            COUNT(*) FILTER (WHERE GREATEST(o.total_amount - o.paid_amount, 0) > 0) AS open_orders,
            MAX(o.date) FILTER (WHERE GREATEST(o.total_amount - o.paid_amount, 0) > 0) AS last_owing_date
        FROM customers c
        JOIN orders o ON o.customer_id = c.id
            AND o.organization_id = p_organization_id
            AND o.is_deleted = false
            AND o.status != 'cancelled'
            AND o.status != 'refunded'
            AND o.payment_status != 'refunded'
        WHERE c.organization_id = p_organization_id
          AND c.is_deleted = false
        GROUP BY c.id, c.first_name, c.last_name, c.email
        HAVING COALESCE(SUM(GREATEST(o.total_amount - o.paid_amount, 0)), 0) > 0
        ORDER BY total_owing DESC
        LIMIT 50
    ) t;

    RETURN jsonb_build_object(
        'total_customers', COALESCE(v_total_customers, 0),
        'new_this_month', COALESCE(v_new_this_month, 0),
        'top_customers', COALESCE(v_top_customers, '[]'::jsonb),
        'customers_owing', COALESCE(v_customers_owing, '[]'::jsonb)
    );
END;
$$;
