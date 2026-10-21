-- Dashboard "All time" support for the stats RPCs.
-- With no start date the totals already covered everything, but:
--   * trends were cut to the last 30 days,
--   * get_sales_stats reported revenue_from_current_sales as 0.
-- Trends now start at the first record when there is no start date, and
-- ranges longer than 92 days are bucketed by month instead of by day.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.stats_trend_window(
    p_first TIMESTAMPTZ,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (v_start TIMESTAMPTZ, v_end TIMESTAMPTZ, v_bucket TEXT)
LANGUAGE sql
STABLE
AS $$
    WITH w AS (
        SELECT
            COALESCE(p_start_date, LEAST(COALESCE(p_first, NOW()), COALESCE(p_end_date, NOW()))) AS s,
            COALESCE(p_end_date, NOW()) AS e
    )
    SELECT
        CASE WHEN w.e - w.s > INTERVAL '92 days' THEN date_trunc('month', w.s) ELSE date_trunc('day', w.s) END,
        w.e,
        CASE WHEN w.e - w.s > INTERVAL '92 days' THEN 'month' ELSE 'day' END
    FROM w;
$$;

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
    v_first TIMESTAMPTZ;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_bucket TEXT;
BEGIN
    IF p_start_date IS NULL THEN
        SELECT MIN(op.created_at) INTO v_first
        FROM order_payments op
        JOIN orders o ON op.order_id = o.id
        WHERE o.organization_id = p_organization_id
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
        AND o.is_deleted = false;
    END IF;

    SELECT w.v_start, w.v_end, w.v_bucket
    INTO v_start_date, v_end_date, v_bucket
    FROM public.stats_trend_window(v_first, p_start_date, p_end_date) w;

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

    SELECT COALESCE(SUM(amount), 0)
    INTO v_revenue_collected
    FROM order_payments op
    JOIN orders o ON op.order_id = o.id
    WHERE o.organization_id = p_organization_id
    AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
    AND (p_start_date IS NULL OR op.created_at >= p_start_date)
    AND (p_end_date IS NULL OR op.created_at <= p_end_date)
    AND o.is_deleted = false;

    SELECT
        COALESCE(SUM(op.amount) FILTER (WHERE p_start_date IS NULL OR o.date >= p_start_date), 0),
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

    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT
            TO_CHAR(b, CASE WHEN v_bucket = 'month' THEN 'Mon YYYY' ELSE 'Mon DD' END) as date,
            COALESCE(op_agg.amount, 0) as value
        FROM generate_series(v_start_date, v_end_date, ('1 ' || v_bucket)::interval) as b
        LEFT JOIN (
            SELECT
                date_trunc(v_bucket, op.created_at) as p_bucket,
                SUM(op.amount) as amount
            FROM order_payments op
            JOIN orders o ON op.order_id = o.id
            WHERE o.organization_id = p_organization_id
            AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
            AND o.is_deleted = false
            AND op.created_at >= v_start_date
            AND op.created_at <= v_end_date + INTERVAL '1 day'
            GROUP BY 1
        ) op_agg ON op_agg.p_bucket = date_trunc(v_bucket, b)
        ORDER BY b
    ) t;

    RETURN jsonb_build_object(
        'total_orders', COALESCE(v_total_orders, 0),
        'total_revenue', COALESCE(v_revenue_collected, 0),
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
    v_first TIMESTAMPTZ;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_bucket TEXT;
BEGIN
    IF p_start_date IS NULL THEN
        SELECT MIN(date)::timestamptz INTO v_first
        FROM expenses
        WHERE organization_id = p_organization_id
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
        AND is_deleted = false;
    END IF;

    SELECT w.v_start, w.v_end, w.v_bucket
    INTO v_start_date, v_end_date, v_bucket
    FROM public.stats_trend_window(v_first, p_start_date, p_end_date) w;

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

    SELECT jsonb_agg(t)
    INTO v_trend
    FROM (
        SELECT
            TO_CHAR(b, CASE WHEN v_bucket = 'month' THEN 'Mon YYYY' ELSE 'Mon DD' END) as date,
            COALESCE(e_agg.amount, 0) as value
        FROM generate_series(v_start_date, v_end_date, ('1 ' || v_bucket)::interval) as b
        LEFT JOIN (
            SELECT date_trunc(v_bucket, e.date::timestamptz) as e_bucket, SUM(e.amount) as amount
            FROM expenses e
            WHERE e.organization_id = p_organization_id
            AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR e.branch_id = ANY(p_branch_ids))
            AND e.status != 'rejected'
            AND e.is_deleted = false
            AND e.date >= v_start_date::date
            AND e.date <= v_end_date::date
            GROUP BY 1
        ) e_agg ON e_agg.e_bucket = date_trunc(v_bucket, b)
        ORDER BY b
    ) t;

    RETURN jsonb_build_object(
        'total_records', COALESCE(v_total_records, 0),
        'total_expenditure', COALESCE(v_total_expenditure, 0),
        'top_category', v_top_category,
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;

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
    v_first TIMESTAMPTZ;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_bucket TEXT;
BEGIN
    IF p_start_date IS NULL THEN
        SELECT MIN(created_at) INTO v_first
        FROM customers
        WHERE organization_id = p_organization_id
        AND is_deleted = false;
    END IF;

    SELECT w.v_start, w.v_end, w.v_bucket
    INTO v_start_date, v_end_date, v_bucket
    FROM public.stats_trend_window(v_first, p_start_date, p_end_date) w;

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
    INTO v_trend
    FROM (
        SELECT
            TO_CHAR(b, CASE WHEN v_bucket = 'month' THEN 'Mon YYYY' ELSE 'Mon DD' END) as date,
            COALESCE(c_agg.n, 0) as value
        FROM generate_series(v_start_date, v_end_date, ('1 ' || v_bucket)::interval) as b
        LEFT JOIN (
            SELECT date_trunc(v_bucket, c.created_at) as c_bucket, COUNT(*) as n
            FROM customers c
            WHERE c.organization_id = p_organization_id
            AND c.is_deleted = false
            AND c.created_at >= v_start_date
            AND c.created_at <= v_end_date + INTERVAL '1 day'
            GROUP BY 1
        ) c_agg ON c_agg.c_bucket = date_trunc(v_bucket, b)
        ORDER BY b
    ) t;

    RETURN jsonb_build_object(
        'total_customers', COALESCE(v_total_customers, 0),
        'new_this_period', COALESCE(v_new_this_period, 0),
        'trend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$;
