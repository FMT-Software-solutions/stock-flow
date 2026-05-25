-- Fixes for Sales Stats and Reports RPCs
-- 1. Adds 'o.is_deleted = false' check to order_payments joins to prevent deleted orders from inflating revenue.
-- 2. Fixes Trend Chart SQL to correctly isolate payments by organization before joining to the date series.

-- 1. Update get_sales_stats RPC
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

    -- Calculate Revenue Collected (Cashflow) strictly from order_payments
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

    -- Trend Data (Daily Revenue - Paid Amount from order_payments)
    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT 
            TO_CHAR(day, 'Mon DD') as date,
            COALESCE(op_agg.amount, 0) as value
        FROM generate_series(v_start_date, v_end_date, '1 day'::interval) as day
        LEFT JOIN (
            SELECT 
                op.created_at::date as p_date, 
                SUM(op.amount) as amount
            FROM order_payments op
            JOIN orders o ON op.order_id = o.id
            WHERE o.organization_id = p_organization_id
            AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
            AND o.is_deleted = false
            AND op.created_at >= v_start_date
            AND op.created_at <= v_end_date + INTERVAL '1 day'
            GROUP BY op.created_at::date
        ) op_agg ON op_agg.p_date = day::date
        ORDER BY day
    ) t;

    RETURN jsonb_build_object(
        'total_orders', COALESCE(v_total_orders, 0),
        'total_revenue', COALESCE(v_revenue_collected, 0), -- Kept for backward compatibility
        'gross_sales', COALESCE(v_gross_sales, 0),
        'revenue_collected', COALESCE(v_revenue_collected, 0),
        'revenue_from_current_sales', COALESCE(v_revenue_from_current_sales, 0),
        'revenue_from_previous_sales', COALESCE(v_revenue_from_previous_sales, 0),
        'owings', COALESCE(v_owings, 0),
        'refunds', COALESCE(v_refunds, 0),
        'breakdown', COALESCE(v_breakdown, '{}'::jsonb),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

-- Ensure no overloaded legacy signature remains (removes ambiguity in PostgREST)
DROP FUNCTION IF EXISTS public.get_sales_report(
    UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT
);

-- 2. Update get_sales_report RPC
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

    RETURN jsonb_build_object(
        'total_orders', COALESCE(v_total_orders, 0),
        'gross_sales', COALESCE(v_gross_sales, 0),
        'total_revenue', COALESCE(v_revenue_collected, 0), -- Kept for backward compatibility
        'revenue_collected', COALESCE(v_revenue_collected, 0),
        'revenue_from_previous_sales', COALESCE(v_revenue_from_previous_sales, 0),
        'revenue_from_current_sales', COALESCE(v_revenue_from_current_sales, 0),
        'breakdown', COALESCE(v_breakdown, '{}'::jsonb),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;