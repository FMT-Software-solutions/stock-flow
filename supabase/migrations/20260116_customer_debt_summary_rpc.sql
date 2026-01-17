CREATE OR REPLACE FUNCTION get_customer_debt_summary(
    p_organization_id UUID,
    p_customer_id UUID,
    p_branch_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_owing NUMERIC;
    v_open_orders BIGINT;
    v_last_owing_date TIMESTAMPTZ;
BEGIN
    SELECT
        COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0),
        COUNT(*) FILTER (WHERE GREATEST(total_amount - paid_amount, 0) > 0),
        MAX(date) FILTER (WHERE GREATEST(total_amount - paid_amount, 0) > 0)
    INTO
        v_total_owing,
        v_open_orders,
        v_last_owing_date
    FROM orders
    WHERE organization_id = p_organization_id
      AND customer_id = p_customer_id
      AND is_deleted = false
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR branch_id = ANY(p_branch_ids))
      AND status != 'cancelled'
      AND status != 'refunded'
      AND payment_status != 'refunded';

    RETURN jsonb_build_object(
        'total_owing', COALESCE(v_total_owing, 0),
        'open_orders', COALESCE(v_open_orders, 0),
        'last_owing_date', v_last_owing_date
    );
END;
$$;

