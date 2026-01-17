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
            COALESCE(SUM(o.paid_amount), 0) AS total_spent,
            COUNT(o.id) AS orders_count
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
            AND o.organization_id = p_organization_id
            AND o.is_deleted = false
            AND o.status != 'cancelled'
            AND o.status != 'refunded'
            AND o.payment_status != 'refunded'
            AND (p_start_date IS NULL OR o.date >= p_start_date)
            AND (p_end_date IS NULL OR o.date <= p_end_date)
        WHERE c.organization_id = p_organization_id
          AND c.is_deleted = false
        GROUP BY c.id, c.first_name, c.last_name, c.email
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

CREATE OR REPLACE FUNCTION get_suppliers_report(
    p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_suppliers BIGINT;
    v_new_this_month BIGINT;
    v_new_suppliers JSONB;
    v_top_suppliers JSONB;
BEGIN
    SELECT COUNT(*)
    INTO v_total_suppliers
    FROM suppliers
    WHERE organization_id = p_organization_id
      AND is_deleted = false;

    SELECT COUNT(*)
    INTO v_new_this_month
    FROM suppliers
    WHERE organization_id = p_organization_id
      AND is_deleted = false
      AND created_at >= date_trunc('month', NOW())
      AND created_at < date_trunc('month', NOW()) + interval '1 month';

    SELECT jsonb_agg(t)
    INTO v_new_suppliers
    FROM (
        SELECT 
            s.id,
            s.name,
            s.created_at
        FROM suppliers s
        WHERE s.organization_id = p_organization_id
          AND s.is_deleted = false
          AND s.created_at >= date_trunc('month', NOW())
          AND s.created_at < date_trunc('month', NOW()) + interval '1 month'
        ORDER BY s.created_at DESC
        LIMIT 50
    ) t;

    SELECT jsonb_agg(t)
    INTO v_top_suppliers
    FROM (
        SELECT s.id AS supplier_id, s.name AS name, COUNT(p.id) AS product_count
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
        'new_this_month', COALESCE(v_new_this_month, 0),
        'new_suppliers', COALESCE(v_new_suppliers, '[]'::jsonb),
        'top_suppliers', COALESCE(v_top_suppliers, '[]'::jsonb)
    );
END;
$$;

