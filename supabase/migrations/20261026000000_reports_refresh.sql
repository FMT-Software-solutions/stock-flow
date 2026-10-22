-- Reports refresh (v1.1.7)
--
-- Brings the report RPCs in line with the products/stock/discount changes:
--   * products that don't track stock are never "low" or "out of stock"
--   * deleted products no longer appear in stock lists
--   * stock levels and stock value are "right now" figures: the date range no
--     longer filters them (stock history is its own report)
--   * stock value at selling price uses the variant price
--   * low/out-of-stock rows say which variant, label and branch they are
--   * the sales ledger carries discounts
--   * new reports: product sales, stock activity, discounts
--
-- The rewritten SECURITY DEFINER functions now check that the caller belongs
-- to the organization; the new reports are SECURITY INVOKER and rely on RLS.
-- Signatures are unchanged, so older app versions keep working.


-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_org_member(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = auth.uid() AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- "Black / XL" from {"Color": "Black", "Size": "XL"}
CREATE OR REPLACE FUNCTION public.variant_display_name(p_attributes JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(string_agg(value, ' / ' ORDER BY key), '')
  FROM jsonb_each_text(COALESCE(p_attributes, '{}'::jsonb));
$$;


-- ---------------------------------------------------------------------------
-- Products report
--   Product counts follow the date range (products added in the period).
--   Stock lists are current and skip untracked and deleted products.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_products_report(
    p_organization_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_counts RECORD;
    v_low BIGINT;
    v_out BIGINT;
    v_category_distribution JSONB;
    v_low_list JSONB;
    v_out_list JSONB;
BEGIN
    PERFORM public.assert_org_member(p_organization_id);

    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'published') AS active,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft,
        COUNT(*) FILTER (WHERE status NOT IN ('published', 'draft')) AS archived,
        COUNT(*) FILTER (WHERE NOT track_stock) AS untracked
    INTO v_counts
    FROM products
    WHERE organization_id = p_organization_id
      AND is_deleted = false
      AND (p_start_date IS NULL OR created_at::date >= p_start_date::date)
      AND (p_end_date IS NULL OR created_at::date <= p_end_date::date);

    -- Current stock of tracked, existing products.
    CREATE TEMP TABLE IF NOT EXISTS _report_stock ON COMMIT DROP AS
    SELECT pv.id, pv.name, pv.sku, pv.category_name, pv.quantity, pv.min_stock_level
    FROM products_view pv
    WHERE false;
    TRUNCATE _report_stock;

    INSERT INTO _report_stock
    SELECT pv.id, pv.name, pv.sku, pv.category_name, pv.quantity, pv.min_stock_level
    FROM products_view pv
    WHERE pv.organization_id = p_organization_id
      AND pv.is_deleted = false
      AND pv.track_stock = true;

    SELECT COUNT(*) INTO v_low FROM _report_stock WHERE quantity > 0 AND quantity <= min_stock_level;
    SELECT COUNT(*) INTO v_out FROM _report_stock WHERE quantity <= 0;

    SELECT jsonb_agg(t) INTO v_low_list FROM (
        SELECT * FROM _report_stock
        WHERE quantity > 0 AND quantity <= min_stock_level
        ORDER BY quantity ASC LIMIT 100
    ) t;

    SELECT jsonb_agg(t) INTO v_out_list FROM (
        SELECT * FROM _report_stock
        WHERE quantity <= 0
        ORDER BY quantity ASC LIMIT 100
    ) t;

    SELECT jsonb_agg(t) INTO v_category_distribution FROM (
        SELECT COALESCE(c.name, 'Uncategorized') AS category, COUNT(p.id) AS count
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE p.organization_id = p_organization_id
          AND p.is_deleted = false
          AND (p_start_date IS NULL OR p.created_at::date >= p_start_date::date)
          AND (p_end_date IS NULL OR p.created_at::date <= p_end_date::date)
        GROUP BY c.id, c.name
        ORDER BY count DESC
        LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'total_products', COALESCE(v_counts.total, 0),
        'active_products', COALESCE(v_counts.active, 0),
        'draft_products', COALESCE(v_counts.draft, 0),
        'archived_products', COALESCE(v_counts.archived, 0),
        -- kept for older app versions: everything that isn't active
        'inactive_products', COALESCE(v_counts.draft, 0) + COALESCE(v_counts.archived, 0),
        'untracked_products', COALESCE(v_counts.untracked, 0),
        'low_stock_products', COALESCE(v_low, 0),
        'out_of_stock_products', COALESCE(v_out, 0),
        'category_distribution', COALESCE(v_category_distribution, '[]'::jsonb),
        'low_stock_list', COALESCE(v_low_list, '[]'::jsonb),
        'out_of_stock_list', COALESCE(v_out_list, '[]'::jsonb)
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- Inventory report (current stock; the date parameters are accepted for
-- compatibility and ignored)
-- ---------------------------------------------------------------------------

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
        'out_of_stock_list', COALESCE(v_out_list, '[]'::jsonb)
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- Dashboard product stats: same as 20260104_dashboard_stats_rpc.sql, with
-- stock counts limited to tracked, existing products.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_product_stats(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    PERFORM public.assert_org_member(p_organization_id);

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'published'),
        COUNT(*) FILTER (WHERE status != 'published')
    INTO v_total_products, v_active_products, v_inactive_products
    FROM products
    WHERE organization_id = p_organization_id
      AND is_deleted = false;

    SELECT COUNT(DISTINCT i.product_id)
    INTO v_low_stock_products
    FROM inventory i
    JOIN products p ON p.id = i.product_id AND p.is_deleted = false AND p.track_stock = true
    WHERE i.organization_id = p_organization_id
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
      AND i.quantity <= i.min_stock_level AND i.quantity > 0
      AND i.is_deleted = false;

    SELECT COUNT(DISTINCT i.product_id)
    INTO v_out_of_stock_products
    FROM inventory i
    JOIN products p ON p.id = i.product_id AND p.is_deleted = false AND p.track_stock = true
    WHERE i.organization_id = p_organization_id
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR i.branch_id = ANY(p_branch_ids))
      AND i.quantity <= 0
      AND i.is_deleted = false;

    SELECT jsonb_agg(t) INTO v_top_categories FROM (
        SELECT c.name AS category, COUNT(p.id) AS count
        FROM product_categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_deleted = false
        WHERE c.organization_id = p_organization_id
        GROUP BY c.id, c.name
        ORDER BY count DESC
        LIMIT 5
    ) t;

    SELECT jsonb_agg(t) INTO v_least_categories FROM (
        SELECT c.name AS category, COUNT(p.id) AS count
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


-- ---------------------------------------------------------------------------
-- Sales ledger: as 20260518000002_sales_report_ledger_rpc.sql, plus the
-- order's subtotal and discount, each line's discount, and the discounts
-- applied (order_discounts, from the discounts rebuild).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_sales_report_ledger(
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
    v_orders JSONB;
BEGIN
    PERFORM public.assert_org_member(p_organization_id);

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'date', o.date,
            'created_at', o.created_at,
            'updated_at', o.updated_at,
            'subtotal', o.subtotal,
            'discount', COALESCE(o.discount, 0),
            'total_amount', o.total_amount,
            'paid_amount', o.paid_amount,
            'status', o.status,
            'payment_status', o.payment_status,
            'customer', CASE WHEN c.id IS NOT NULL THEN jsonb_build_object(
                'id', c.id,
                'first_name', c.first_name,
                'last_name', c.last_name,
                'email', c.email
            ) ELSE NULL END,
            'branch', CASE WHEN b.id IS NOT NULL THEN jsonb_build_object(
                'id', b.id,
                'name', b.name
            ) ELSE NULL END,
            'items', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'product_name', oi.product_name,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'discount_amount', COALESCE(oi.discount_amount, 0)
                )), '[]'::jsonb)
                FROM order_items oi WHERE oi.order_id = o.id
            ),
            'discounts', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'name', od.name,
                    'kind', od.kind,
                    'code', od.code,
                    'amount', od.amount
                ) ORDER BY od.created_at), '[]'::jsonb)
                FROM order_discounts od WHERE od.order_id = o.id
            ),
            'period_collected', (
                SELECT COALESCE(SUM(op.amount), 0)
                FROM order_payments op
                WHERE op.order_id = o.id
                  AND (p_start_date IS NULL OR op.created_at >= p_start_date)
                  AND (p_end_date IS NULL OR op.created_at <= p_end_date)
            ),
            'payments', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', op.id,
                        'amount', op.amount,
                        'payment_method', op.payment_method,
                        'notes', op.notes,
                        'created_at', op.created_at,
                        'recorded_by', trim(COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Unknown'))
                    ) ORDER BY op.created_at DESC
                ), '[]'::jsonb)
                FROM order_payments op
                LEFT JOIN profiles u ON op.created_by = u.id
                WHERE op.order_id = o.id
                  AND (p_start_date IS NULL OR op.created_at >= p_start_date)
                  AND (p_end_date IS NULL OR op.created_at <= p_end_date)
            )
        ) ORDER BY o.date DESC, o.created_at DESC
    ), '[]'::jsonb)
    INTO v_orders
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN branches b ON o.branch_id = b.id
    WHERE o.organization_id = p_organization_id
      AND o.is_deleted = false
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
      AND (
          (p_start_date IS NULL OR o.date >= p_start_date) AND (p_end_date IS NULL OR o.date <= p_end_date)
          OR
          EXISTS (
              SELECT 1 FROM order_payments op2
              WHERE op2.order_id = o.id
                AND (p_start_date IS NULL OR op2.created_at >= p_start_date)
                AND (p_end_date IS NULL OR op2.created_at <= p_end_date)
          )
      );

    RETURN jsonb_build_object('orders', v_orders);
END;
$$;


-- ---------------------------------------------------------------------------
-- Product sales: what sold, by product / variant / stock label.
-- Counts sales dated in the period that aren't cancelled, refunded or
-- deleted. Net = line total - the line's share of all discounts.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_product_sales_report(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows JSONB;
    v_categories JSONB;
    v_totals JSONB;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS _sold (
        product_id UUID, variant_id UUID, label TEXT, name TEXT, variant TEXT,
        category TEXT, order_id UUID, quantity NUMERIC, gross NUMERIC, discount NUMERIC
    ) ON COMMIT DROP;
    TRUNCATE _sold;

    INSERT INTO _sold
    SELECT
        oi.product_id,
        oi.variant_id,
        NULLIF(i.custom_label, ''),
        COALESCE(p.name, oi.product_name),
        public.variant_display_name(v.attributes),
        COALESCE(pc.name, 'Uncategorized'),
        o.id,
        oi.quantity,
        oi.quantity * oi.unit_price,
        COALESCE(oi.discount_amount, 0)
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_variants v ON v.id = oi.variant_id
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN inventory i ON i.id = oi.inventory_id
    WHERE o.organization_id = p_organization_id
      AND o.is_deleted = false
      AND o.status NOT IN ('cancelled', 'refunded')
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
      AND (p_start_date IS NULL OR o.date >= p_start_date)
      AND (p_end_date IS NULL OR o.date <= p_end_date);

    SELECT jsonb_agg(t ORDER BY t.net DESC) INTO v_rows FROM (
        SELECT
            product_id, variant_id, label,
            -- lines without a product (very old data) group by their name
            MIN(name) AS name, MIN(variant) AS variant, MIN(category) AS category,
            COUNT(DISTINCT order_id) AS orders,
            SUM(quantity) AS quantity,
            SUM(gross) AS gross,
            SUM(discount) AS discounts,
            SUM(gross) - SUM(discount) AS net
        FROM _sold
        GROUP BY product_id, variant_id, label, CASE WHEN product_id IS NULL THEN name END
    ) t;

    SELECT jsonb_agg(t ORDER BY t.net DESC) INTO v_categories FROM (
        SELECT category, SUM(quantity) AS quantity, SUM(gross) - SUM(discount) AS net
        FROM _sold GROUP BY category
    ) t;

    SELECT jsonb_build_object(
        'orders', COUNT(DISTINCT order_id),
        'quantity', COALESCE(SUM(quantity), 0),
        'gross', COALESCE(SUM(gross), 0),
        'discounts', COALESCE(SUM(discount), 0),
        'net', COALESCE(SUM(gross) - SUM(discount), 0)
    ) INTO v_totals FROM _sold;

    RETURN jsonb_build_object(
        'totals', v_totals,
        'products', COALESCE(v_rows, '[]'::jsonb),
        'categories', COALESCE(v_categories, '[]'::jsonb)
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- Stock activity: stock_movements in the period, per item and in total,
-- plus the latest individual changes.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_stock_activity_report(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_by_reason JSONB;
    v_items JSONB;
    v_recent JSONB;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS _moves (
        id UUID, inventory_id UUID, product_id UUID, name TEXT, variant TEXT, label TEXT,
        branch_name TEXT, reason TEXT, change NUMERIC, quantity_after NUMERIC, note TEXT,
        order_number TEXT, created_by_name TEXT, created_at TIMESTAMPTZ
    ) ON COMMIT DROP;
    TRUNCATE _moves;

    INSERT INTO _moves
    SELECT
        m.id, m.inventory_id, m.product_id,
        COALESCE(p.name, 'Removed product'),
        public.variant_display_name(v.attributes),
        NULLIF(i.custom_label, ''),
        b.name,
        m.reason, m.change, m.quantity_after, m.note,
        o.order_number,
        NULLIF(trim(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), ''),
        m.created_at
    FROM stock_movements m
    LEFT JOIN products p ON p.id = m.product_id
    LEFT JOIN product_variants v ON v.id = m.variant_id
    LEFT JOIN inventory i ON i.id = m.inventory_id
    LEFT JOIN branches b ON b.id = m.branch_id
    LEFT JOIN orders o ON o.id = m.order_id
    LEFT JOIN profiles pr ON pr.id = m.created_by
    WHERE m.organization_id = p_organization_id
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR m.branch_id = ANY(p_branch_ids))
      AND (p_start_date IS NULL OR m.created_at >= p_start_date)
      AND (p_end_date IS NULL OR m.created_at <= p_end_date);

    SELECT jsonb_object_agg(reason, total) INTO v_by_reason FROM (
        SELECT reason, SUM(change) AS total FROM _moves GROUP BY reason
    ) t;

    SELECT jsonb_agg(t ORDER BY t.name, t.variant NULLS FIRST, t.branch_name) INTO v_items FROM (
        SELECT
            inventory_id,
            MIN(name) AS name, MIN(variant) AS variant, MIN(label) AS label, MIN(branch_name) AS branch_name,
            SUM(change) FILTER (WHERE reason IN ('opening', 'received')) AS received,
            -SUM(change) FILTER (WHERE reason IN ('sale', 'sale_reversal')) AS sold,
            SUM(change) FILTER (WHERE reason = 'return') AS returned,
            -SUM(change) FILTER (WHERE reason = 'damaged') AS damaged,
            SUM(change) FILTER (WHERE reason IN ('count', 'correction', 'edit', 'other')) AS adjusted,
            SUM(change) AS net_change,
            (ARRAY_AGG(quantity_after ORDER BY created_at DESC))[1] AS closing
        FROM _moves
        GROUP BY inventory_id
    ) t;

    SELECT jsonb_agg(t) INTO v_recent FROM (
        SELECT id, created_at, name, variant, label, branch_name, reason, change,
               quantity_after, note, order_number, created_by_name
        FROM _moves
        ORDER BY created_at DESC
        LIMIT 500
    ) t;

    RETURN jsonb_build_object(
        'by_reason', COALESCE(v_by_reason, '{}'::jsonb),
        'items', COALESCE(v_items, '[]'::jsonb),
        'recent', COALESCE(v_recent, '[]'::jsonb)
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- Discounts: what each discount gave away in the period. Manual discounts
-- are grouped by who gave them.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_discounts_report(
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows JSONB;
    v_totals JSONB;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS _given (
        discount_id UUID, kind TEXT, name TEXT, code TEXT, given_by TEXT,
        order_id UUID, amount NUMERIC, order_total NUMERIC, order_date TIMESTAMPTZ
    ) ON COMMIT DROP;
    TRUNCATE _given;

    INSERT INTO _given
    SELECT
        od.discount_id, od.kind, COALESCE(d.name, od.name), od.code,
        CASE WHEN od.kind = 'manual'
             THEN NULLIF(trim(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), '')
        END,
        o.id, od.amount, o.total_amount, o.date
    FROM order_discounts od
    JOIN orders o ON o.id = od.order_id
    LEFT JOIN discounts d ON d.id = od.discount_id
    LEFT JOIN profiles pr ON pr.id = od.created_by
    WHERE od.organization_id = p_organization_id
      AND o.is_deleted = false
      AND o.status NOT IN ('cancelled', 'refunded')
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY(p_branch_ids))
      AND (p_start_date IS NULL OR o.date >= p_start_date)
      AND (p_end_date IS NULL OR o.date <= p_end_date);

    SELECT jsonb_agg(t ORDER BY t.amount DESC) INTO v_rows FROM (
        SELECT
            discount_id, kind,
            MIN(name) AS name, MIN(code) AS code, given_by,
            COUNT(DISTINCT order_id) AS orders,
            SUM(amount) AS amount,
            -- sales the discount was used on, after all their discounts
            (SELECT SUM(x.order_total) FROM (
                SELECT DISTINCT g2.order_id, g2.order_total FROM _given g2
                WHERE g2.discount_id IS NOT DISTINCT FROM g.discount_id
                  AND g2.kind = g.kind
                  AND g2.given_by IS NOT DISTINCT FROM g.given_by
            ) x) AS sales,
            MAX(order_date) AS last_used
        FROM _given g
        GROUP BY discount_id, kind, given_by
    ) t;

    SELECT jsonb_build_object(
        'amount', COALESCE(SUM(amount), 0),
        'orders', COUNT(DISTINCT order_id),
        'automatic', COALESCE(SUM(amount) FILTER (WHERE kind = 'automatic'), 0),
        'code', COALESCE(SUM(amount) FILTER (WHERE kind = 'code'), 0),
        'manual', COALESCE(SUM(amount) FILTER (WHERE kind = 'manual'), 0)
    ) INTO v_totals FROM _given;

    RETURN jsonb_build_object(
        'totals', v_totals,
        'discounts', COALESCE(v_rows, '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_sales_report(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_activity_report(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discounts_report(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
