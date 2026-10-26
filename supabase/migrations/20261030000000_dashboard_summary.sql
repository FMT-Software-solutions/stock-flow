-- Dashboard in one call.
--
-- get_dashboard_summary returns everything the dashboard shows for a period
-- and branch selection: key figures for the period and the one before it,
-- sales over time for both, top products, payments by method, branches,
-- recent sales, what needs attention now, and a few counts.
--
-- Sales follow the reports: orders dated in the period that aren't
-- cancelled, refunded or deleted. Cash collected is payments received in the
-- period (order_payments.created_at), including payments on older sales, as
-- the old dashboard counted it.
--
-- Runs as the caller (RLS applies) after a membership check.

-- One period's key figures. NULL bounds are open.
CREATE OR REPLACE FUNCTION public.dashboard_period_figures(
  p_organization_id UUID,
  p_branch_ids UUID[],
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_tz TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH s AS (
    SELECT o.total_amount, o.paid_amount, o.discount
    FROM orders o
    WHERE o.organization_id = p_organization_id
      AND o.is_deleted = FALSE
      AND o.status NOT IN ('cancelled', 'refunded')
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY (p_branch_ids))
      AND (p_start IS NULL OR o.date >= p_start)
      AND (p_end IS NULL OR o.date <= p_end)
  )
  SELECT jsonb_build_object(
    'net', COALESCE((SELECT SUM(total_amount) FROM s), 0),
    'orders', (SELECT COUNT(*) FROM s),
    'discounts', COALESCE((SELECT SUM(discount) FROM s), 0),
    'owed', COALESCE((SELECT SUM(GREATEST(total_amount - COALESCE(paid_amount, 0), 0)) FROM s), 0),
    'collected', COALESCE((
      SELECT SUM(op.amount)
      FROM order_payments op
      JOIN orders o ON o.id = op.order_id
      WHERE o.organization_id = p_organization_id
        AND o.is_deleted = FALSE
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY (p_branch_ids))
        AND (p_start IS NULL OR op.created_at >= p_start)
        AND (p_end IS NULL OR op.created_at <= p_end)
    ), 0),
    'expenses', COALESCE((
      SELECT SUM(e.amount)
      FROM expenses e
      WHERE e.organization_id = p_organization_id
        AND COALESCE(e.is_deleted, FALSE) = FALSE
        AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR e.branch_id = ANY (p_branch_ids))
        AND (p_start IS NULL OR e.date >= (p_start AT TIME ZONE p_tz)::DATE)
        AND (p_end IS NULL OR e.date <= (p_end AT TIME ZONE p_tz)::DATE)
    ), 0)
  );
$$;

-- Sales per hour/day/month in the organization's local time:
-- [{ "slot": "2026-05-16T00", "net": 30380, "orders": 16 }], empty slots left out.
CREATE OR REPLACE FUNCTION public.dashboard_period_series(
  p_organization_id UUID,
  p_branch_ids UUID[],
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_bucket TEXT,
  p_tz TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('slot', slot, 'net', net, 'orders', n) ORDER BY slot), '[]'::jsonb)
  FROM (
    SELECT to_char(date_trunc(p_bucket, o.date AT TIME ZONE p_tz), 'YYYY-MM-DD"T"HH24') AS slot,
           SUM(o.total_amount) AS net,
           COUNT(*) AS n
    FROM orders o
    WHERE o.organization_id = p_organization_id
      AND o.is_deleted = FALSE
      AND o.status NOT IN ('cancelled', 'refunded')
      AND (p_branch_ids IS NULL OR cardinality(p_branch_ids) = 0 OR o.branch_id = ANY (p_branch_ids))
      AND (p_start IS NULL OR o.date >= p_start)
      AND (p_end IS NULL OR o.date <= p_end)
    GROUP BY 1
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_organization_id UUID,
  p_branch_ids UUID[] DEFAULT NULL,
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL,
  p_prev_start TIMESTAMPTZ DEFAULT NULL,
  p_prev_end TIMESTAMPTZ DEFAULT NULL,
  p_bucket TEXT DEFAULT 'day',
  p_tz TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_branches UUID[] := CASE WHEN cardinality(p_branch_ids) = 0 THEN NULL ELSE p_branch_ids END;
  v_has_prev BOOLEAN := p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL;
  v_first TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  PERFORM public.assert_org_member(p_organization_id);

  IF p_bucket NOT IN ('hour', 'day', 'month') THEN
    RAISE EXCEPTION 'Unknown bucket "%"', p_bucket;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_tz) THEN
    RAISE EXCEPTION 'Unknown time zone "%"', p_tz;
  END IF;

  -- All time: the chart starts at the first sale.
  IF p_start IS NULL THEN
    SELECT MIN(o.date) INTO v_first
    FROM orders o
    WHERE o.organization_id = p_organization_id AND o.is_deleted = FALSE
      AND (v_branches IS NULL OR o.branch_id = ANY (v_branches));
  END IF;

  SELECT jsonb_build_object(
    'first_sale', v_first,
    'current', public.dashboard_period_figures(p_organization_id, v_branches, p_start, p_end, p_tz),
    'previous', CASE WHEN v_has_prev THEN public.dashboard_period_figures(p_organization_id, v_branches, p_prev_start, p_prev_end, p_tz) END,
    'series', public.dashboard_period_series(p_organization_id, v_branches, p_start, p_end, p_bucket, p_tz),
    'previous_series', CASE WHEN v_has_prev THEN public.dashboard_period_series(p_organization_id, v_branches, p_prev_start, p_prev_end, p_bucket, p_tz) ELSE '[]'::jsonb END,

    'top_products', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.net DESC)
      FROM (
        SELECT oi.product_id, COALESCE(p.name, MIN(oi.product_name)) AS name,
               SUM(oi.quantity) AS quantity,
               SUM(oi.quantity * oi.unit_price - COALESCE(oi.discount_amount, 0)) AS net
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.organization_id = p_organization_id
          AND o.is_deleted = FALSE
          AND o.status NOT IN ('cancelled', 'refunded')
          AND (v_branches IS NULL OR o.branch_id = ANY (v_branches))
          AND (p_start IS NULL OR o.date >= p_start)
          AND (p_end IS NULL OR o.date <= p_end)
        GROUP BY oi.product_id, p.name
        ORDER BY 4 DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),

    'payments', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.amount DESC)
      FROM (
        SELECT COALESCE(NULLIF(op.payment_method, ''), 'other') AS method,
               SUM(op.amount) AS amount,
               COUNT(*) AS payments
        FROM order_payments op
        JOIN orders o ON o.id = op.order_id
        WHERE o.organization_id = p_organization_id
          AND o.is_deleted = FALSE
          AND (v_branches IS NULL OR o.branch_id = ANY (v_branches))
          AND (p_start IS NULL OR op.created_at >= p_start)
          AND (p_end IS NULL OR op.created_at <= p_end)
        GROUP BY 1
      ) t
    ), '[]'::jsonb),

    'branches', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.net DESC, t.name)
      FROM (
        SELECT b.id, b.name,
               COALESCE(SUM(o.total_amount), 0) AS net,
               COUNT(o.id) AS orders
        FROM branches b
        LEFT JOIN orders o ON o.branch_id = b.id
          AND o.is_deleted = FALSE
          AND o.status NOT IN ('cancelled', 'refunded')
          AND (p_start IS NULL OR o.date >= p_start)
          AND (p_end IS NULL OR o.date <= p_end)
        WHERE b.organization_id = p_organization_id
          AND (v_branches IS NULL OR b.id = ANY (v_branches))
        GROUP BY b.id, b.name
      ) t
    ), '[]'::jsonb),

    'recent', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.date DESC)
      FROM (
        SELECT o.id, o.order_number, o.date, o.total_amount AS total, o.paid_amount AS paid,
               o.payment_status, o.status, b.name AS branch,
               NULLIF(btrim(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), '') AS customer
        FROM orders o
        LEFT JOIN branches b ON b.id = o.branch_id
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.organization_id = p_organization_id
          AND o.is_deleted = FALSE
          AND (v_branches IS NULL OR o.branch_id = ANY (v_branches))
        ORDER BY o.date DESC
        LIMIT 8
      ) t
    ), '[]'::jsonb),

    -- What needs attention now (not limited to the period).
    'attention', jsonb_build_object(
      'stock', COALESCE((
        SELECT jsonb_agg(t ORDER BY t.out DESC, t.low DESC, t.branch)
        FROM (
          SELECT b.id AS branch_id, b.name AS branch,
                 COUNT(*) FILTER (WHERE i.quantity <= 0) AS out,
                 COUNT(*) FILTER (WHERE i.quantity > 0 AND i.quantity <= i.min_stock_level) AS low
          FROM inventory i
          JOIN products p ON p.id = i.product_id AND p.is_deleted = FALSE AND p.track_stock
          JOIN branches b ON b.id = i.branch_id
          WHERE i.organization_id = p_organization_id
            AND i.is_deleted = FALSE
            AND (v_branches IS NULL OR i.branch_id = ANY (v_branches))
          GROUP BY b.id, b.name
          HAVING COUNT(*) FILTER (WHERE i.quantity <= 0) > 0
              OR COUNT(*) FILTER (WHERE i.quantity > 0 AND i.quantity <= i.min_stock_level) > 0
        ) t
      ), '[]'::jsonb),
      'owed', (
        SELECT jsonb_build_object(
          'amount', COALESCE(SUM(d.amount), 0),
          'sales', COALESCE(SUM(d.sales), 0),
          'customers', COUNT(*) FILTER (WHERE d.customer_id IS NOT NULL),
          'top', COALESCE((
            SELECT jsonb_agg(x ORDER BY x.amount DESC)
            FROM (SELECT d2.name, d2.amount FROM (
              SELECT o.customer_id,
                     COALESCE(NULLIF(btrim(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), ''), 'Walk-in') AS name,
                     SUM(o.total_amount - COALESCE(o.paid_amount, 0)) AS amount
              FROM orders o
              LEFT JOIN customers c ON c.id = o.customer_id
              WHERE o.organization_id = p_organization_id
                AND o.is_deleted = FALSE
                AND o.status NOT IN ('cancelled', 'refunded')
                AND o.total_amount > COALESCE(o.paid_amount, 0)
                AND (v_branches IS NULL OR o.branch_id = ANY (v_branches))
              GROUP BY o.customer_id, 2
            ) d2 ORDER BY d2.amount DESC LIMIT 3) x
          ), '[]'::jsonb)
        )
        FROM (
          SELECT o.customer_id, SUM(o.total_amount - COALESCE(o.paid_amount, 0)) AS amount, COUNT(*) AS sales
          FROM orders o
          WHERE o.organization_id = p_organization_id
            AND o.is_deleted = FALSE
            AND o.status NOT IN ('cancelled', 'refunded')
            AND o.total_amount > COALESCE(o.paid_amount, 0)
            AND (v_branches IS NULL OR o.branch_id = ANY (v_branches))
          GROUP BY o.customer_id
        ) d
      ),
      'pending', (
        SELECT COUNT(*) FROM orders o
        WHERE o.organization_id = p_organization_id
          AND o.is_deleted = FALSE
          AND o.status IN ('pending', 'processing')
          AND (v_branches IS NULL OR o.branch_id = ANY (v_branches))
      ),
      'discounts_ending', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'ends_at', d.ends_at) ORDER BY d.ends_at)
        FROM discounts d
        WHERE d.organization_id = p_organization_id
          AND d.is_active
          AND d.archived_at IS NULL
          AND d.ends_at BETWEEN now() AND now() + INTERVAL '7 days'
      ), '[]'::jsonb)
    ),

    'counts', jsonb_build_object(
      'customers', (SELECT COUNT(*) FROM customers c WHERE c.organization_id = p_organization_id AND COALESCE(c.is_deleted, FALSE) = FALSE),
      'products', (SELECT COUNT(*) FROM products p WHERE p.organization_id = p_organization_id AND p.is_deleted = FALSE),
      'suppliers', (SELECT COUNT(*) FROM suppliers s WHERE s.organization_id = p_organization_id),
      'branches', (SELECT COUNT(*) FROM branches b WHERE b.organization_id = p_organization_id),
      'users', (SELECT COUNT(*) FROM user_organizations u WHERE u.organization_id = p_organization_id)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;


-- AI summaries, kept per user, period and branches so the dashboard doesn't
-- ask the model again on every visit. Written only by the dashboard-summary
-- edge function (service role); each user reads their own.
CREATE TABLE IF NOT EXISTS public.dashboard_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  lines JSONB NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, cache_key)
);

ALTER TABLE public.dashboard_ai_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_ai_summaries_own ON public.dashboard_ai_summaries;
CREATE POLICY dashboard_ai_summaries_own ON public.dashboard_ai_summaries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
