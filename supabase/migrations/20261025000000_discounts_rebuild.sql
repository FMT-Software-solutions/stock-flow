-- Discounts rebuild
--
-- Replaces the inventory-row discount model with rule-based discounts that are
-- validated, priced and counted on the server, in the same transaction as the
-- sale.
--
--   discounts            the rules (reset: existing rows were test data)
--   discount_targets     categories / products / variants an item discount covers
--   order_discounts      what each sale actually got (snapshot, drives usage counts)
--   user_can             server-side permission check
--   compute_sale_discounts  the pricing engine (preview, create and update share it)
--   preview_sale         sale screen preview
--   create_order         now prices discounts itself
--   update_order         transactional sale edit
--   list_discounts / save_discount / set_discount_active / archive_discount
--
-- Kept for v1.1.6 clients until they update: the discounts table itself and
-- inventory.discount_id (the old inventory list embeds discounts through it).
-- Safe to re-run.


-- ---------------------------------------------------------------------------
-- 1. Remove the old model
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_order(JSONB, JSONB, UUID);
DROP FUNCTION IF EXISTS public.increment_discount_usage(UUID);
DROP FUNCTION IF EXISTS public.manage_inventory_discount(UUID, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.get_valid_inventory_discounts(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.get_discount_details(UUID, UUID);
DROP TABLE IF EXISTS public.inventory_discounts;

-- Old-shape rows are test data; inventory.discount_id is cleared by its FK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'method'
  ) THEN
    DELETE FROM public.discounts;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 2. discounts
-- ---------------------------------------------------------------------------

ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_type_check;
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_target_mode_check;
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_usage_mode_check;
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_usage_limit_check;
DROP INDEX IF EXISTS public.idx_discounts_org_code_unique;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'start_at') THEN
    ALTER TABLE public.discounts RENAME COLUMN start_at TO starts_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'expires_at') THEN
    ALTER TABLE public.discounts RENAME COLUMN expires_at TO ends_at;
  END IF;
END $$;

ALTER TABLE public.discounts
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS target_mode,
  DROP COLUMN IF EXISTS usage_mode,
  DROP COLUMN IF EXISTS times_used;

ALTER TABLE public.discounts
  -- 'automatic' applies itself; 'code' needs the code at the till
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'automatic',
  -- 'items' discounts lines; 'order' discounts the sale subtotal
  ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT 'items',
  ADD COLUMN IF NOT EXISTS value_type TEXT NOT NULL DEFAULT 'percentage',
  -- items + fixed_amount: true = the amount once per sale, spread over the
  -- eligible lines; false = the amount off every eligible unit
  ADD COLUMN IF NOT EXISTS once_per_order BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS min_subtotal NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS min_quantity NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usage_limit INTEGER,
  ADD COLUMN IF NOT EXISTS usage_limit_per_customer INTEGER,
  ADD COLUMN IF NOT EXISTS combinable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.discounts ALTER COLUMN value TYPE NUMERIC(12, 2);
ALTER TABLE public.discounts ALTER COLUMN is_active SET DEFAULT TRUE;
UPDATE public.discounts SET is_active = TRUE WHERE is_active IS NULL;
ALTER TABLE public.discounts ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_rules_check;
ALTER TABLE public.discounts ADD CONSTRAINT discounts_rules_check CHECK (
  method IN ('automatic', 'code')
  AND target IN ('items', 'order')
  AND value_type IN ('percentage', 'fixed_amount', 'fixed_price')
  AND applies_to IN ('all', 'categories', 'products')
  AND value >= 0
  AND (value_type <> 'percentage' OR value <= 100)
  AND (method <> 'code' OR NULLIF(btrim(code), '') IS NOT NULL)
  AND (target <> 'order' OR (value_type <> 'fixed_price' AND applies_to = 'all'))
  AND (min_subtotal IS NULL OR min_subtotal >= 0)
  AND (min_quantity IS NULL OR min_quantity >= 0)
  AND (usage_limit IS NULL OR usage_limit >= 1)
  AND (usage_limit_per_customer IS NULL OR usage_limit_per_customer >= 1)
  AND (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS discounts_org_code_unique
  ON public.discounts (organization_id, lower(code))
  WHERE code IS NOT NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS discounts_org_idx ON public.discounts (organization_id) WHERE archived_at IS NULL;


CREATE TABLE IF NOT EXISTS public.discount_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  discount_id UUID NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  CONSTRAINT discount_targets_one_kind CHECK (
    (category_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL)
    OR (category_id IS NULL AND product_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS discount_targets_discount_idx ON public.discount_targets (discount_id);


-- What a sale got. discount_id is NULL for a manual (cashier) discount.
CREATE TABLE IF NOT EXISTS public.order_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  discount_id UUID REFERENCES public.discounts(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('automatic', 'code', 'manual')),
  name TEXT NOT NULL,
  code TEXT,
  target TEXT NOT NULL CHECK (target IN ('items', 'order')),
  value_type TEXT NOT NULL,
  value NUMERIC(12, 2) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_discounts_order_idx ON public.order_discounts (order_id);
CREATE INDEX IF NOT EXISTS order_discounts_discount_idx ON public.order_discounts (discount_id);


-- ---------------------------------------------------------------------------
-- 3. Access
--
-- discounts and discount_targets are only reached through the RPCs below,
-- which check membership and permissions. With RLS on and no policy, direct
-- reads return nothing: codes stay hidden, and v1.1.6 clients (which read the
-- table and would misprice the new rows) simply see no discounts. The table
-- grant stays so their inventory query, which embeds discounts, keeps working.
-- ---------------------------------------------------------------------------

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org users manage discounts" ON public.discounts;
DROP POLICY IF EXISTS "Org users read discounts" ON public.discounts;
DROP POLICY IF EXISTS "Org users read discount targets" ON public.discount_targets;

-- Written by create_order / update_order (SECURITY INVOKER), like order_items.
DROP POLICY IF EXISTS "Org users manage order discounts" ON public.order_discounts;
CREATE POLICY "Org users manage order discounts" ON public.order_discounts
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.order_discounts TO authenticated;


-- Does the current user have this permission in the organization?
-- Owners always do. A per-user override replaces the role's entry for a scope,
-- as in the app (modules/permissions buildUserPermissions).
CREATE OR REPLACE FUNCTION public.user_can(p_org UUID, p_scope TEXT, p_action TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    LEFT JOIN public.organization_roles r
      ON r.id = COALESCE(
        uo.role_id,
        (SELECT r2.id FROM public.organization_roles r2
         WHERE r2.organization_id = uo.organization_id AND r2.type = uo.role LIMIT 1)
      )
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        CASE WHEN NULLIF(btrim(uo.permissions), '') IS NULL THEN NULL
             ELSE uo.permissions::jsonb -> p_scope END,
        NULLIF(r.permissions, '')::jsonb -> p_scope
      ) AS perm
    ) s
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id = p_org
      AND (
        uo.role = 'owner'
        OR r.type = 'owner'
        OR (
          COALESCE((s.perm ->> 'enabled')::BOOLEAN, FALSE)
          AND (p_action IS NULL OR (s.perm -> 'actions') ? p_action)
        )
      )
  );
$$;

-- New action: orders.give_discount (manual cashier discounts).
DO $$
DECLARE
  rec RECORD;
  perms JSONB;
  actions JSONB;
BEGIN
  FOR rec IN SELECT id, type, permissions FROM public.organization_roles WHERE type IN ('owner', 'admin', 'branch_admin') LOOP
    perms := COALESCE(NULLIF(rec.permissions, '')::jsonb, '{}'::jsonb);
    IF perms -> 'orders' IS NULL THEN
      perms := jsonb_set(perms, '{orders}', jsonb_build_object('enabled', true, 'actions', '[]'::jsonb), true);
    END IF;
    actions := COALESCE(perms -> 'orders' -> 'actions', '[]'::jsonb);
    IF NOT (actions ? 'give_discount') THEN
      actions := actions || '"give_discount"'::jsonb;
      perms := jsonb_set(perms, '{orders,actions}', actions, true);
      UPDATE public.organization_roles SET permissions = perms::text WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;


-- ---------------------------------------------------------------------------
-- 4. Pricing engine
--
-- p_items      [{inventory_id?, product_id, variant_id?, quantity, unit_price}]
--              (the order_items payload); lines are referred to by position i (1-based)
-- p_discounts  {codes: [text], skip: [uuid], manual: {value_type, value, reason}?}
--
-- Rules
--   * Item discounts: each line gets at most one, the one that saves the most.
--     Different lines may get different item discounts.
--   * Order discounts: at most one per sale.
--   * Item and order discounts apply together only when both are combinable;
--     otherwise the combination that saves the customer most wins.
--   * Minimums are checked against the eligible lines (item discounts) or the
--     whole sale (order discounts), before discounts.
--   * A manual discount applies last, to what is left, and always combines.
--   * When editing a sale (p_is_edit), discounts already on it stay valid even
--     if they have since expired, been paused or run out; new automatic
--     discounts are not added to an old sale.
--
-- Returns
--   {subtotal, discount_total, total,
--    lines: [{i, gross, discount, item_discount_id}],
--    discounts: [{discount_id, kind, name, code, target, value_type, value, amount, reason}],
--    rejected: [{code, reason}], manual_error}
-- ---------------------------------------------------------------------------

-- Splits p_amount over weighted lines {"i": weight}; the last line takes the rounding.
CREATE OR REPLACE FUNCTION public.allocate_amount(p_weights JSONB, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  WITH w AS (
    SELECT key AS i, value::NUMERIC AS weight
    FROM jsonb_each_text(COALESCE(p_weights, '{}'::jsonb))
    WHERE value::NUMERIC > 0
  ),
  t AS (SELECT SUM(weight) AS total FROM w),
  s AS (
    SELECT w.i, ROUND(p_amount * w.weight / t.total, 2) AS share,
           ROW_NUMBER() OVER (ORDER BY w.i::INT DESC) AS rn
    FROM w, t
    WHERE t.total > 0
  )
  SELECT COALESCE(jsonb_object_agg(i,
           CASE WHEN rn = 1 THEN ROUND(p_amount, 2) - COALESCE((SELECT SUM(share) FROM s s2 WHERE s2.rn > 1), 0)
                ELSE share END), '{}'::jsonb)
  FROM s;
$$;

CREATE OR REPLACE FUNCTION public.compute_sale_discounts(
  p_org UUID,
  p_branch UUID,
  p_customer UUID,
  p_items JSONB,
  p_discounts JSONB DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_is_edit BOOLEAN DEFAULT FALSE,
  p_lock BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lines JSONB;
  v_subtotal NUMERIC := 0;
  v_total_qty NUMERIC := 0;
  v_codes TEXT[];
  v_skip UUID[];
  v_manual JSONB;
  v_existing UUID[] := '{}';
  v_existing_coded UUID[] := '{}';
  v_existing_manual JSONB;
  v_matched_codes TEXT[] := '{}';
  v_rejected JSONB := '[]';
  v_item_cands JSONB := '[]';
  v_order_cands JSONB := '[]';
  d RECORD;
  v_is_existing BOOLEAN;
  v_reason TEXT;
  v_uses BIGINT;
  v_cats UUID[];
  v_elig JSONB;
  v_elig_sub NUMERIC;
  v_elig_qty NUMERIC;
  v_amounts JSONB;
  v_cand JSONB;
  -- selection
  v_pick_all JSONB;
  v_pick_comb JSONB;
  v_items_all NUMERIC;
  v_items_comb NUMERIC;
  v_best_order JSONB;
  v_best_order_amt NUMERIC;
  v_best_comb_order JSONB;
  v_best_comb_order_amt NUMERIC;
  v_choice TEXT := 'items';
  v_best NUMERIC;
  v_pick JSONB := '{}';
  v_order_pick JSONB;
  v_order_amt NUMERIC := 0;
  v_line_item JSONB := '{}';
  v_line_order JSONB := '{}';
  v_line_manual JSONB := '{}';
  v_weights JSONB;
  v_remaining NUMERIC;
  v_manual_amt NUMERIC := 0;
  v_manual_error TEXT;
  v_applied JSONB := '[]';
  v_out_lines JSONB;
  v_discount_total NUMERIC;
  v_amt NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations WHERE user_id = auth.uid() AND organization_id = p_org
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lower(btrim(c))), '{}')
  INTO v_codes
  FROM jsonb_array_elements_text(COALESCE(p_discounts -> 'codes', '[]'::jsonb)) c
  WHERE btrim(c) <> '';

  SELECT COALESCE(array_agg(s::UUID), '{}')
  INTO v_skip
  FROM jsonb_array_elements_text(COALESCE(p_discounts -> 'skip', '[]'::jsonb)) s;

  v_manual := CASE WHEN jsonb_typeof(p_discounts -> 'manual') = 'object'
                    AND COALESCE((p_discounts -> 'manual' ->> 'value')::NUMERIC, 0) > 0
                   THEN p_discounts -> 'manual' END;

  IF p_is_edit AND p_order_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(discount_id) FILTER (WHERE discount_id IS NOT NULL), '{}'),
           (array_agg(jsonb_build_object('value_type', value_type, 'value', value)) FILTER (WHERE kind = 'manual'))[1]
    INTO v_existing, v_existing_manual
    FROM public.order_discounts WHERE order_id = p_order_id;

    -- Code discounts already on the sale, matched by the code it was sold with
    -- (the discount's code may have changed since).
    SELECT COALESCE(array_agg(discount_id), '{}'), COALESCE(array_agg(lower(code)), '{}')
    INTO v_existing_coded, v_matched_codes
    FROM public.order_discounts
    WHERE order_id = p_order_id AND discount_id IS NOT NULL AND kind = 'code'
      AND lower(code) = ANY (v_codes);
  END IF;

  -- Lines, with their category (and its ancestors) for targeting.
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'i', t.ord::TEXT,
      'product_id', NULLIF(t.e ->> 'product_id', ''),
      'variant_id', NULLIF(t.e ->> 'variant_id', ''),
      'category_id', p.category_id,
      'qty', x.qty,
      'gross', ROUND(x.qty * x.price, 2)
    ) ORDER BY t.ord) FILTER (WHERE x.qty > 0), '[]'::jsonb),
    COALESCE(SUM(ROUND(x.qty * x.price, 2)) FILTER (WHERE x.qty > 0), 0),
    COALESCE(SUM(x.qty) FILTER (WHERE x.qty > 0), 0)
  INTO v_lines, v_subtotal, v_total_qty
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY AS t(e, ord)
  CROSS JOIN LATERAL (
    SELECT COALESCE(NULLIF(t.e ->> 'quantity', '')::NUMERIC, 0) AS qty,
           GREATEST(COALESCE(NULLIF(t.e ->> 'unit_price', '')::NUMERIC, 0), 0) AS price
  ) x
  LEFT JOIN public.products p
    ON p.id = NULLIF(t.e ->> 'product_id', '')::UUID AND p.organization_id = p_org;

  IF p_lock THEN
    PERFORM 1 FROM public.discounts
    WHERE organization_id = p_org
      AND (usage_limit IS NOT NULL OR usage_limit_per_customer IS NOT NULL)
      AND (method = 'automatic' OR lower(code) = ANY (v_codes) OR id = ANY (v_existing))
    ORDER BY id
    FOR UPDATE;
  END IF;

  -- Candidates
  FOR d IN
    SELECT * FROM public.discounts
    WHERE organization_id = p_org
      AND (
        id = ANY (v_existing)
        OR (archived_at IS NULL AND method = 'automatic' AND NOT p_is_edit)
        OR (archived_at IS NULL AND method = 'code' AND lower(code) = ANY (v_codes))
      )
    ORDER BY created_at, id
  LOOP
    v_is_existing := d.id = ANY (v_existing);
    IF d.code IS NOT NULL AND lower(d.code) = ANY (v_codes) THEN
      v_matched_codes := v_matched_codes || lower(d.code);
    END IF;
    -- A code discount is only considered when its code is entered.
    IF d.method = 'code' AND NOT (lower(d.code) = ANY (v_codes)) AND NOT (d.id = ANY (v_existing_coded)) THEN
      CONTINUE;
    END IF;
    IF d.method = 'automatic' AND d.id = ANY (v_skip) THEN
      CONTINUE;
    END IF;

    v_reason := NULL;
    IF NOT v_is_existing THEN
      IF NOT d.is_active THEN v_reason := 'Paused';
      ELSIF d.starts_at IS NOT NULL AND d.starts_at > now() THEN v_reason := 'Not started yet';
      ELSIF d.ends_at IS NOT NULL AND d.ends_at <= now() THEN v_reason := 'Expired';
      END IF;
    END IF;

    IF v_reason IS NULL AND COALESCE(cardinality(d.branch_ids), 0) > 0
       AND (p_branch IS NULL OR NOT (p_branch = ANY (d.branch_ids))) THEN
      v_reason := 'Not valid at this branch';
    END IF;

    IF v_reason IS NULL AND COALESCE(cardinality(d.customer_ids), 0) > 0 THEN
      IF p_customer IS NULL THEN v_reason := 'Select the customer first';
      ELSIF NOT (p_customer = ANY (d.customer_ids)) THEN v_reason := 'Not valid for this customer';
      END IF;
    END IF;

    IF v_reason IS NULL AND NOT v_is_existing AND d.usage_limit IS NOT NULL THEN
      SELECT COUNT(DISTINCT od.order_id) INTO v_uses
      FROM public.order_discounts od
      JOIN public.orders o ON o.id = od.order_id AND o.is_deleted = FALSE
      WHERE od.discount_id = d.id AND od.order_id IS DISTINCT FROM p_order_id;
      IF v_uses >= d.usage_limit THEN v_reason := 'Usage limit reached'; END IF;
    END IF;

    IF v_reason IS NULL AND NOT v_is_existing AND d.usage_limit_per_customer IS NOT NULL THEN
      IF p_customer IS NULL THEN
        v_reason := 'Select the customer first';
      ELSE
        SELECT COUNT(DISTINCT od.order_id) INTO v_uses
        FROM public.order_discounts od
        JOIN public.orders o ON o.id = od.order_id AND o.is_deleted = FALSE
        WHERE od.discount_id = d.id AND o.customer_id = p_customer
          AND od.order_id IS DISTINCT FROM p_order_id;
        IF v_uses >= d.usage_limit_per_customer THEN v_reason := 'Customer already used it'; END IF;
      END IF;
    END IF;

    IF v_reason IS NULL AND d.target = 'items' THEN
      -- Categories cover their subcategories.
      IF d.applies_to = 'categories' THEN
        WITH RECURSIVE cats AS (
          SELECT category_id AS id FROM public.discount_targets
          WHERE discount_id = d.id AND category_id IS NOT NULL
          UNION
          SELECT c.id FROM public.product_categories c JOIN cats ON c.parent_id = cats.id
        )
        SELECT COALESCE(array_agg(id), '{}') INTO v_cats FROM cats;
      END IF;

      SELECT COALESCE(jsonb_agg(l), '[]'::jsonb),
             COALESCE(SUM((l ->> 'gross')::NUMERIC), 0),
             COALESCE(SUM((l ->> 'qty')::NUMERIC), 0)
      INTO v_elig, v_elig_sub, v_elig_qty
      FROM jsonb_array_elements(v_lines) l
      WHERE d.applies_to = 'all'
         OR (d.applies_to = 'categories' AND (l ->> 'category_id')::UUID = ANY (v_cats))
         OR (d.applies_to = 'products' AND EXISTS (
              SELECT 1 FROM public.discount_targets dt
              WHERE dt.discount_id = d.id
                AND dt.product_id = (l ->> 'product_id')::UUID
                AND (dt.variant_id IS NULL OR dt.variant_id = (l ->> 'variant_id')::UUID)
            ));

      IF jsonb_array_length(v_elig) = 0 THEN
        v_reason := 'No eligible items';
      ELSIF d.min_subtotal IS NOT NULL AND v_elig_sub < d.min_subtotal THEN
        v_reason := 'Minimum spend ' || to_char(d.min_subtotal, 'FM999999990.00');
      ELSIF d.min_quantity IS NOT NULL AND v_elig_qty < d.min_quantity THEN
        v_reason := 'Minimum ' || rtrim(to_char(d.min_quantity, 'FM999999990.##'), '.') || ' items';
      END IF;

      IF v_reason IS NULL THEN
        IF d.value_type = 'fixed_amount' AND d.once_per_order THEN
          SELECT public.allocate_amount(
                   jsonb_object_agg(l ->> 'i', l ->> 'gross'),
                   LEAST(d.value, v_elig_sub))
          INTO v_amounts
          FROM jsonb_array_elements(v_elig) l;
        ELSE
          SELECT COALESCE(jsonb_object_agg(l ->> 'i', a.amt) FILTER (WHERE a.amt > 0), '{}'::jsonb)
          INTO v_amounts
          FROM jsonb_array_elements(v_elig) l
          CROSS JOIN LATERAL (
            SELECT CASE d.value_type
              WHEN 'percentage' THEN ROUND((l ->> 'gross')::NUMERIC * d.value / 100, 2)
              WHEN 'fixed_amount' THEN LEAST((l ->> 'gross')::NUMERIC, ROUND(d.value * (l ->> 'qty')::NUMERIC, 2))
              WHEN 'fixed_price' THEN GREATEST(0, (l ->> 'gross')::NUMERIC - ROUND(d.value * (l ->> 'qty')::NUMERIC, 2))
            END AS amt
          ) a;
        END IF;

        IF v_amounts = '{}'::jsonb THEN
          v_reason := 'No saving on these items';
        END IF;
      END IF;

      IF v_reason IS NULL THEN
        v_item_cands := v_item_cands || jsonb_build_array(jsonb_build_object(
          'id', d.id, 'kind', d.method, 'name', d.name, 'code', d.code,
          'value_type', d.value_type, 'value', d.value,
          'combinable', d.combinable, 'amounts', v_amounts));
      END IF;

    ELSIF v_reason IS NULL AND d.target = 'order' THEN
      IF v_subtotal <= 0 THEN
        v_reason := 'No eligible items';
      ELSIF d.min_subtotal IS NOT NULL AND v_subtotal < d.min_subtotal THEN
        v_reason := 'Minimum spend ' || to_char(d.min_subtotal, 'FM999999990.00');
      ELSIF d.min_quantity IS NOT NULL AND v_total_qty < d.min_quantity THEN
        v_reason := 'Minimum ' || rtrim(to_char(d.min_quantity, 'FM999999990.##'), '.') || ' items';
      ELSE
        v_order_cands := v_order_cands || jsonb_build_array(jsonb_build_object(
          'id', d.id, 'kind', d.method, 'name', d.name, 'code', d.code,
          'value_type', d.value_type, 'value', d.value, 'combinable', d.combinable));
      END IF;
    END IF;

    IF v_reason IS NOT NULL AND d.method = 'code' THEN
      v_rejected := v_rejected || jsonb_build_array(jsonb_build_object('code', d.code, 'reason', v_reason));
    END IF;
  END LOOP;

  SELECT v_rejected || COALESCE(jsonb_agg(jsonb_build_object('code', c, 'reason', 'Code not found')), '[]'::jsonb)
  INTO v_rejected
  FROM unnest(v_codes) c
  WHERE NOT (c = ANY (v_matched_codes));

  -- Item discounts: best per line, from all candidates or only combinable ones.
  SELECT COALESCE(jsonb_object_agg(k, jsonb_build_object('id', id, 'amt', amt)), '{}'::jsonb),
         COALESCE(SUM(amt), 0)
  INTO v_pick_all, v_items_all
  FROM (
    SELECT DISTINCT ON (k) k, c ->> 'id' AS id, (c -> 'amounts' ->> k)::NUMERIC AS amt
    FROM jsonb_array_elements(v_item_cands) c, jsonb_object_keys(c -> 'amounts') k
    ORDER BY k, (c -> 'amounts' ->> k)::NUMERIC DESC, (c ->> 'kind' = 'code') DESC, c ->> 'id'
  ) s;

  SELECT COALESCE(jsonb_object_agg(k, jsonb_build_object('id', id, 'amt', amt)), '{}'::jsonb),
         COALESCE(SUM(amt), 0)
  INTO v_pick_comb, v_items_comb
  FROM (
    SELECT DISTINCT ON (k) k, c ->> 'id' AS id, (c -> 'amounts' ->> k)::NUMERIC AS amt
    FROM jsonb_array_elements(v_item_cands) c, jsonb_object_keys(c -> 'amounts') k
    WHERE (c ->> 'combinable')::BOOLEAN
    ORDER BY k, (c -> 'amounts' ->> k)::NUMERIC DESC, (c ->> 'kind' = 'code') DESC, c ->> 'id'
  ) s;

  -- Order discounts: best on the full subtotal, and best combinable one on what
  -- is left after combinable item discounts.
  SELECT c, a INTO v_best_order, v_best_order_amt
  FROM jsonb_array_elements(v_order_cands) c
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c ->> 'value_type' = 'percentage'
                THEN ROUND(v_subtotal * (c ->> 'value')::NUMERIC / 100, 2)
                ELSE LEAST((c ->> 'value')::NUMERIC, v_subtotal) END AS a
  ) x
  ORDER BY a DESC, (c ->> 'kind' = 'code') DESC, c ->> 'id'
  LIMIT 1;

  SELECT c, a INTO v_best_comb_order, v_best_comb_order_amt
  FROM jsonb_array_elements(v_order_cands) c
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c ->> 'value_type' = 'percentage'
                THEN ROUND((v_subtotal - v_items_comb) * (c ->> 'value')::NUMERIC / 100, 2)
                ELSE LEAST((c ->> 'value')::NUMERIC, v_subtotal - v_items_comb) END AS a
  ) x
  WHERE (c ->> 'combinable')::BOOLEAN
  ORDER BY a DESC, (c ->> 'kind' = 'code') DESC, c ->> 'id'
  LIMIT 1;

  v_best := v_items_all;
  v_choice := 'items';
  IF v_best_comb_order IS NOT NULL AND v_items_comb + v_best_comb_order_amt > v_best THEN
    v_best := v_items_comb + v_best_comb_order_amt;
    v_choice := 'both';
  END IF;
  IF v_best_order IS NOT NULL AND v_best_order_amt > v_best THEN
    v_best := v_best_order_amt;
    v_choice := 'order';
  END IF;

  IF v_choice = 'items' THEN
    v_pick := v_pick_all;
  ELSIF v_choice = 'both' THEN
    v_pick := v_pick_comb;
    v_order_pick := v_best_comb_order;
    v_order_amt := v_best_comb_order_amt;
  ELSE
    v_order_pick := v_best_order;
    v_order_amt := v_best_order_amt;
  END IF;

  SELECT COALESCE(jsonb_object_agg(key, (value ->> 'amt')::NUMERIC), '{}'::jsonb)
  INTO v_line_item
  FROM jsonb_each(v_pick);

  -- Spread order-level amounts over what each line still costs.
  SELECT jsonb_object_agg(l ->> 'i', (l ->> 'gross')::NUMERIC - COALESCE((v_line_item ->> (l ->> 'i'))::NUMERIC, 0))
  INTO v_weights
  FROM jsonb_array_elements(v_lines) l;

  IF v_order_amt > 0 THEN
    v_line_order := public.allocate_amount(v_weights, v_order_amt);
  END IF;

  -- Manual discount on what is left.
  v_remaining := v_subtotal - v_best;
  IF v_manual IS NOT NULL THEN
    IF NOT (
      public.user_can(p_org, 'orders', 'give_discount')
      OR (v_existing_manual IS NOT NULL
          AND v_existing_manual ->> 'value_type' = v_manual ->> 'value_type'
          AND (v_existing_manual ->> 'value')::NUMERIC = (v_manual ->> 'value')::NUMERIC)
    ) THEN
      v_manual_error := 'Not allowed to give discounts';
    ELSIF v_manual ->> 'value_type' NOT IN ('percentage', 'fixed_amount') THEN
      v_manual_error := 'Invalid discount';
    ELSIF v_manual ->> 'value_type' = 'percentage' AND (v_manual ->> 'value')::NUMERIC > 100 THEN
      v_manual_error := 'At most 100%';
    ELSIF v_remaining <= 0 THEN
      v_manual_error := 'Nothing left to discount';
    ELSE
      v_manual_amt := CASE WHEN v_manual ->> 'value_type' = 'percentage'
                           THEN ROUND(v_remaining * (v_manual ->> 'value')::NUMERIC / 100, 2)
                           ELSE LEAST(ROUND((v_manual ->> 'value')::NUMERIC, 2), v_remaining) END;
      SELECT jsonb_object_agg(l ->> 'i',
               (l ->> 'gross')::NUMERIC
               - COALESCE((v_line_item ->> (l ->> 'i'))::NUMERIC, 0)
               - COALESCE((v_line_order ->> (l ->> 'i'))::NUMERIC, 0))
      INTO v_weights
      FROM jsonb_array_elements(v_lines) l;
      v_line_manual := public.allocate_amount(v_weights, v_manual_amt);
    END IF;
  END IF;

  -- Applied discounts, item ones first.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'discount_id', c ->> 'id', 'kind', c ->> 'kind', 'name', c ->> 'name', 'code', c ->> 'code',
           'target', 'items', 'value_type', c ->> 'value_type', 'value', (c ->> 'value')::NUMERIC,
           'amount', s.amt, 'reason', NULL) ORDER BY c ->> 'name'), '[]'::jsonb)
  INTO v_applied
  FROM jsonb_array_elements(v_item_cands) c
  JOIN (
    SELECT value ->> 'id' AS id, SUM((value ->> 'amt')::NUMERIC) AS amt
    FROM jsonb_each(v_pick) GROUP BY 1
  ) s ON s.id = c ->> 'id';

  IF v_order_pick IS NOT NULL AND v_order_amt > 0 THEN
    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'discount_id', v_order_pick ->> 'id', 'kind', v_order_pick ->> 'kind', 'name', v_order_pick ->> 'name',
      'code', v_order_pick ->> 'code', 'target', 'order', 'value_type', v_order_pick ->> 'value_type',
      'value', (v_order_pick ->> 'value')::NUMERIC, 'amount', v_order_amt, 'reason', NULL));
  END IF;

  IF v_manual_amt > 0 THEN
    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'discount_id', NULL, 'kind', 'manual', 'name', 'Manual discount', 'code', NULL, 'target', 'order',
      'value_type', v_manual ->> 'value_type', 'value', (v_manual ->> 'value')::NUMERIC,
      'amount', v_manual_amt, 'reason', NULLIF(btrim(v_manual ->> 'reason'), '')));
  END IF;

  -- Codes that are valid but lost to a better or non-combinable discount.
  SELECT v_rejected || COALESCE(jsonb_agg(jsonb_build_object(
           'code', c ->> 'code',
           'reason', CASE WHEN (c ->> 'combinable')::BOOLEAN THEN 'A better discount applies'
                          ELSE 'Can''t combine with the applied discount' END)), '[]'::jsonb)
  INTO v_rejected
  FROM jsonb_array_elements(v_item_cands || v_order_cands) c
  WHERE c ->> 'kind' = 'code'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_applied) a WHERE a ->> 'discount_id' = c ->> 'id');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'i', (l ->> 'i')::INT,
           'gross', (l ->> 'gross')::NUMERIC,
           'discount', COALESCE((v_line_item ->> (l ->> 'i'))::NUMERIC, 0)
                     + COALESCE((v_line_order ->> (l ->> 'i'))::NUMERIC, 0)
                     + COALESCE((v_line_manual ->> (l ->> 'i'))::NUMERIC, 0),
           'item_discount_id', v_pick -> (l ->> 'i') ->> 'id'
         ) ORDER BY (l ->> 'i')::INT), '[]'::jsonb)
  INTO v_out_lines
  FROM jsonb_array_elements(v_lines) l;

  v_discount_total := v_best + v_manual_amt;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'discount_total', v_discount_total,
    'total', v_subtotal - v_discount_total,
    'lines', v_out_lines,
    'discounts', v_applied,
    'rejected', v_rejected,
    'manual_error', v_manual_error
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_sale_discounts(UUID, UUID, UUID, JSONB, JSONB, UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_sale_discounts(UUID, UUID, UUID, JSONB, JSONB, UUID, BOOLEAN, BOOLEAN) TO authenticated;


-- Sale screen preview. p_order needs organization_id, branch_id, customer_id.
CREATE OR REPLACE FUNCTION public.preview_sale(
  p_order JSONB,
  p_items JSONB,
  p_discounts JSONB DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
AS $$
  SELECT public.compute_sale_discounts(
    (p_order ->> 'organization_id')::UUID,
    NULLIF(p_order ->> 'branch_id', '')::UUID,
    NULLIF(p_order ->> 'customer_id', '')::UUID,
    p_items,
    p_discounts,
    p_order_id,
    p_order_id IS NOT NULL,
    FALSE
  );
$$;

REVOKE EXECUTE ON FUNCTION public.preview_sale(JSONB, JSONB, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_sale(JSONB, JSONB, JSONB, UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 5. Stock triggers on order items follow the order's state
--
-- A cancelled, refunded or deleted sale holds no stock, so adding or removing
-- its items must not move stock (update_order replaces items on such sales).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.order_holds_stock(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT status NOT IN ('cancelled', 'refunded') AND NOT is_deleted
     FROM public.orders WHERE id = p_order_id),
    TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.update_inventory_on_order_item_create()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.inventory_id IS NOT NULL AND public.order_holds_stock(NEW.order_id) THEN
        PERFORM public.set_stock_context('sale', NULL, NEW.order_id);
        UPDATE public.inventory
        SET quantity = quantity - NEW.quantity,
            last_updated = now()
        WHERE id = NEW.inventory_id;
        PERFORM public.clear_stock_context();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.restore_inventory_on_order_item_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.inventory_id IS NOT NULL AND public.order_holds_stock(OLD.order_id) THEN
        PERFORM public.set_stock_context('sale_reversal', NULL, OLD.order_id);
        UPDATE public.inventory
        SET quantity = quantity + OLD.quantity,
            last_updated = now()
        WHERE id = OLD.inventory_id;
        PERFORM public.clear_stock_context();
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- 6. create_order / update_order
-- ---------------------------------------------------------------------------

-- Locks and checks the stock rows p_items draw from.
CREATE OR REPLACE FUNCTION public.lock_order_stock(p_org UUID, p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_need RECORD;
BEGIN
  FOR v_need IN
    SELECT
      (e->>'inventory_id')::UUID AS inventory_id,
      SUM((e->>'quantity')::NUMERIC) AS requested,
      MIN(e->>'product_name') AS product_name
    FROM jsonb_array_elements(COALESCE(p_items, '[]')) e
    WHERE NULLIF(e->>'inventory_id', '') IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  LOOP
    PERFORM 1 FROM public.inventory
    WHERE id = v_need.inventory_id
      AND organization_id = p_org
      AND is_deleted = FALSE
      AND quantity >= v_need.requested
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not enough stock for %: % available, % requested',
        COALESCE(v_need.product_name, 'an item'),
        COALESCE((SELECT quantity FROM public.inventory WHERE id = v_need.inventory_id AND is_deleted = FALSE), 0),
        v_need.requested
        USING ERRCODE = 'P0001', HINT = 'insufficient_stock';
    END IF;
  END LOOP;
END;
$$;

-- Payment status that matches what was paid against the new total.
CREATE OR REPLACE FUNCTION public.payment_status_for(p_status TEXT, p_paid NUMERIC, p_total NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'refunded' THEN 'refunded'
    WHEN COALESCE(p_paid, 0) <= 0 THEN CASE WHEN p_total <= 0 THEN 'paid' ELSE 'unpaid' END
    WHEN p_paid >= p_total THEN 'paid'
    ELSE 'partial'
  END;
$$;

-- Writes the priced result onto an order's items and order_discounts.
CREATE OR REPLACE FUNCTION public.write_order_discounts(p_order_id UUID, p_org UUID, p_item_ids UUID[], p_result JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_line JSONB;
BEGIN
  DELETE FROM public.order_discounts WHERE order_id = p_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_result -> 'lines') LOOP
    UPDATE public.order_items
    SET discount_amount = (v_line ->> 'discount')::NUMERIC
    WHERE id = p_item_ids[(v_line ->> 'i')::INT];
  END LOOP;

  INSERT INTO public.order_discounts (organization_id, order_id, discount_id, kind, name, code, target, value_type, value, amount, reason)
  SELECT p_org, p_order_id, NULLIF(a ->> 'discount_id', '')::UUID, a ->> 'kind', a ->> 'name', a ->> 'code',
         a ->> 'target', a ->> 'value_type', (a ->> 'value')::NUMERIC, (a ->> 'amount')::NUMERIC, a ->> 'reason'
  FROM jsonb_array_elements(p_result -> 'discounts') a
  WHERE (a ->> 'amount')::NUMERIC > 0;
END;
$$;

-- p_order      the orders payload (subtotal/discount/total are computed here)
-- p_items      order_items payloads; inventory_id may be null for untracked products
-- p_discounts  {codes, skip, manual, expected_total}; expected_total is what the
--              cashier saw: if discounts changed since (a limit was reached, a
--              code expired) the sale is refused instead of charging a different total.
CREATE OR REPLACE FUNCTION public.create_order(
  p_order JSONB,
  p_items JSONB,
  p_discounts JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order JSONB;
  v_order_id UUID;
  v_org UUID := (p_order->>'organization_id')::UUID;
  v_item JSONB;
  v_item_ids UUID[] := '{}';
  v_priced JSONB;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_status TEXT := COALESCE(p_order->>'status', 'pending');
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  IF v_status NOT IN ('cancelled', 'refunded') THEN
    PERFORM public.lock_order_stock(v_org, p_items);
  END IF;

  v_priced := public.compute_sale_discounts(
    v_org,
    NULLIF(p_order->>'branch_id', '')::UUID,
    NULLIF(p_order->>'customer_id', '')::UUID,
    p_items, p_discounts, NULL, FALSE, TRUE
  );

  IF jsonb_array_length(v_priced -> 'rejected') > 0 THEN
    RAISE EXCEPTION 'Discount code %: %',
      v_priced -> 'rejected' -> 0 ->> 'code', v_priced -> 'rejected' -> 0 ->> 'reason'
      USING ERRCODE = 'P0001', HINT = 'discount_changed';
  END IF;
  IF v_priced ->> 'manual_error' IS NOT NULL THEN
    RAISE EXCEPTION 'Manual discount: %', v_priced ->> 'manual_error'
      USING ERRCODE = 'P0001', HINT = 'discount_changed';
  END IF;

  v_total := (v_priced ->> 'total')::NUMERIC;
  IF p_discounts ? 'expected_total'
     AND ABS((p_discounts ->> 'expected_total')::NUMERIC - v_total) > 0.005 THEN
    RAISE EXCEPTION 'Discounts changed: the total is now %', to_char(v_total, 'FM999999990.00')
      USING ERRCODE = 'P0001', HINT = 'discount_changed';
  END IF;

  v_paid := CASE
    WHEN p_order->>'payment_status' = 'paid' THEN v_total
    WHEN p_order->>'payment_status' = 'refunded' THEN 0
    ELSE LEAST(GREATEST(COALESCE((p_order->>'paid_amount')::NUMERIC, 0), 0), v_total)
  END;

  v_order := public.insert_row_from_jsonb(
    'orders',
    p_order || jsonb_build_object(
      'subtotal', (v_priced ->> 'subtotal')::NUMERIC,
      'discount', (v_priced ->> 'discount_total')::NUMERIC,
      'total_amount', v_total,
      'paid_amount', v_paid,
      'payment_status', public.payment_status_for(p_order->>'payment_status', v_paid, v_total)
    ),
    ARRAY['id', 'order_number', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_deleted']
  );
  v_order_id := (v_order->>'id')::UUID;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]')) LOOP
    v_order := public.insert_row_from_jsonb(
      'order_items',
      v_item || jsonb_build_object(
        'order_id', v_order_id,
        'organization_id', v_org,
        'total_price', ROUND(COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0), 2),
        'discount_amount', 0
      ),
      ARRAY['id', 'created_at']
    );
    v_item_ids := v_item_ids || (v_order->>'id')::UUID;
  END LOOP;

  PERFORM public.write_order_discounts(v_order_id, v_org, v_item_ids, v_priced);

  -- Re-read so values set by AFTER triggers (payments) are included.
  SELECT to_jsonb(o.*) INTO v_order FROM public.orders o WHERE o.id = v_order_id;
  RETURN v_order;
END;
$$;

-- Edits a sale in one transaction: items are replaced (stock follows), the
-- discounts are re-priced with the rules above, and totals are recomputed.
-- Payments are not touched; add or refund them separately.
CREATE OR REPLACE FUNCTION public.update_order(
  p_order_id UUID,
  p_order JSONB,
  p_items JSONB,
  p_discounts JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing public.orders;
  v_org UUID;
  v_branch UUID;
  v_customer UUID;
  v_status TEXT;
  v_item JSONB;
  v_row JSONB;
  v_item_ids UUID[] := '{}';
  v_priced JSONB;
  v_total NUMERIC;
  v_order JSONB;
BEGIN
  SELECT * INTO v_existing FROM public.orders
  WHERE id = p_order_id AND is_deleted = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  v_org := v_existing.organization_id;
  v_branch := CASE WHEN p_order ? 'branch_id' THEN NULLIF(p_order->>'branch_id', '')::UUID ELSE v_existing.branch_id END;
  v_customer := CASE WHEN p_order ? 'customer_id' THEN NULLIF(p_order->>'customer_id', '')::UUID ELSE v_existing.customer_id END;
  v_status := COALESCE(NULLIF(p_order->>'status', ''), v_existing.status);
  IF COALESCE(p_order->>'payment_status', '') = 'refunded' THEN
    v_status := 'refunded';
  END IF;

  -- Price before touching the order: existing discounts are read from it.
  v_priced := public.compute_sale_discounts(
    v_org, v_branch, v_customer, p_items, p_discounts, p_order_id, TRUE, TRUE
  );

  IF jsonb_array_length(v_priced -> 'rejected') > 0 THEN
    RAISE EXCEPTION 'Discount code %: %',
      v_priced -> 'rejected' -> 0 ->> 'code', v_priced -> 'rejected' -> 0 ->> 'reason'
      USING ERRCODE = 'P0001', HINT = 'discount_changed';
  END IF;
  IF v_priced ->> 'manual_error' IS NOT NULL THEN
    RAISE EXCEPTION 'Manual discount: %', v_priced ->> 'manual_error'
      USING ERRCODE = 'P0001', HINT = 'discount_changed';
  END IF;

  v_total := (v_priced ->> 'total')::NUMERIC;
  IF p_discounts ? 'expected_total'
     AND ABS((p_discounts ->> 'expected_total')::NUMERIC - v_total) > 0.005 THEN
    RAISE EXCEPTION 'Discounts changed: the total is now %', to_char(v_total, 'FM999999990.00')
      USING ERRCODE = 'P0001', HINT = 'discount_changed';
  END IF;

  IF v_total < COALESCE(v_existing.paid_amount, 0) AND v_status <> 'refunded' THEN
    RAISE EXCEPTION 'The total cannot be less than what was already paid (%)',
      to_char(v_existing.paid_amount, 'FM999999990.00')
      USING ERRCODE = 'P0001', HINT = 'below_paid';
  END IF;

  -- Old items go back to stock (if the sale holds stock), then the order takes
  -- its new state, then the new items are taken from stock (if it holds stock).
  DELETE FROM public.order_items WHERE order_id = p_order_id;

  UPDATE public.orders SET
    branch_id = v_branch,
    customer_id = v_customer,
    status = v_status,
    payment_method = CASE WHEN p_order ? 'payment_method' THEN p_order->>'payment_method' ELSE payment_method END,
    notes = CASE WHEN p_order ? 'notes' THEN p_order->>'notes' ELSE notes END,
    subtotal = (v_priced ->> 'subtotal')::NUMERIC,
    discount = (v_priced ->> 'discount_total')::NUMERIC,
    total_amount = v_total,
    paid_amount = CASE WHEN v_status = 'refunded' THEN 0 ELSE paid_amount END,
    payment_status = public.payment_status_for(
      CASE WHEN v_status = 'refunded' THEN 'refunded' ELSE payment_status END,
      CASE WHEN v_status = 'refunded' THEN 0 ELSE paid_amount END,
      v_total),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_order_id;

  IF v_status NOT IN ('cancelled', 'refunded') THEN
    PERFORM public.lock_order_stock(v_org, p_items);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]')) LOOP
    v_row := public.insert_row_from_jsonb(
      'order_items',
      v_item || jsonb_build_object(
        'order_id', p_order_id,
        'organization_id', v_org,
        'total_price', ROUND(COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0), 2),
        'discount_amount', 0
      ),
      ARRAY['id', 'created_at']
    );
    v_item_ids := v_item_ids || (v_row->>'id')::UUID;
  END LOOP;

  PERFORM public.write_order_discounts(p_order_id, v_org, v_item_ids, v_priced);

  SELECT to_jsonb(o.*) INTO v_order FROM public.orders o WHERE o.id = p_order_id;
  RETURN v_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lock_order_stock(UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.write_order_discounts(UUID, UUID, UUID[], JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order(JSONB, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_order(UUID, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_order_stock(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_order_discounts(UUID, UUID, UUID[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order(UUID, JSONB, JSONB, JSONB) TO authenticated;


-- ---------------------------------------------------------------------------
-- 7. Managing discounts
-- ---------------------------------------------------------------------------

-- Every non-archived discount with its targets, status and what it has given.
-- Codes are hidden from users without discounts.view_code.
CREATE OR REPLACE FUNCTION public.list_discounts(p_org UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_show_codes BOOLEAN;
BEGIN
  IF NOT public.user_can(p_org, 'discounts') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  v_show_codes := public.user_can(p_org, 'discounts', 'view_code');

  RETURN (
    SELECT COALESCE(jsonb_agg(row ORDER BY (row ->> 'created_at') DESC), '[]'::jsonb)
    FROM (
      SELECT to_jsonb(d.*)
        - 'code'
        || jsonb_build_object(
          'code', CASE WHEN v_show_codes OR d.created_by = auth.uid() THEN d.code
                       WHEN d.code IS NULL THEN NULL ELSE '••••' END,
          'status', CASE
            WHEN NOT d.is_active THEN 'paused'
            WHEN d.ends_at IS NOT NULL AND d.ends_at <= now() THEN 'expired'
            WHEN d.starts_at IS NOT NULL AND d.starts_at > now() THEN 'scheduled'
            WHEN d.usage_limit IS NOT NULL AND COALESCE(u.uses, 0) >= d.usage_limit THEN 'used_up'
            ELSE 'active' END,
          'uses', COALESCE(u.uses, 0),
          'amount_given', COALESCE(u.amount, 0),
          'targets', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'category_id', t.category_id, 'product_id', t.product_id, 'variant_id', t.variant_id,
              'name', COALESCE(c.name, p.name ||
                CASE WHEN v.id IS NULL THEN ''
                     ELSE ' (' || (SELECT string_agg(val, ' / ') FROM jsonb_each_text(COALESCE(v.attributes, '{}'::jsonb)) a(k, val)) || ')' END)
            ) ORDER BY COALESCE(c.name, p.name))
            FROM public.discount_targets t
            LEFT JOIN public.product_categories c ON c.id = t.category_id
            LEFT JOIN public.products p ON p.id = t.product_id
            LEFT JOIN public.product_variants v ON v.id = t.variant_id
            WHERE t.discount_id = d.id
          ), '[]'::jsonb)
        ) AS row
      FROM public.discounts d
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT od.order_id) AS uses, SUM(od.amount) AS amount
        FROM public.order_discounts od
        JOIN public.orders o ON o.id = od.order_id AND o.is_deleted = FALSE
        WHERE od.discount_id = d.id
      ) u ON TRUE
      WHERE d.organization_id = p_org AND d.archived_at IS NULL
    ) s
  );
END;
$$;

-- Creates or updates a discount and replaces its targets.
-- p_discount: the discounts columns plus targets: [{category_id} | {product_id, variant_id?}]
CREATE OR REPLACE FUNCTION public.save_discount(p_org UUID, p_discount JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := NULLIF(p_discount->>'id', '')::UUID;
  v_method TEXT := COALESCE(p_discount->>'method', 'automatic');
  v_target TEXT := COALESCE(p_discount->>'target', 'items');
  v_applies TEXT := COALESCE(p_discount->>'applies_to', 'all');
  v_code TEXT := NULLIF(btrim(p_discount->>'code'), '');
BEGIN
  IF v_id IS NULL AND NOT public.user_can(p_org, 'discounts', 'create') THEN
    RAISE EXCEPTION 'Not allowed to create discounts' USING ERRCODE = '42501';
  END IF;
  IF v_id IS NOT NULL AND NOT public.user_can(p_org, 'discounts', 'edit') THEN
    RAISE EXCEPTION 'Not allowed to edit discounts' USING ERRCODE = '42501';
  END IF;

  -- Staff who can't see codes edit without one; the code stays as it is.
  IF v_id IS NOT NULL AND COALESCE((p_discount->>'keep_code')::BOOLEAN, FALSE) THEN
    SELECT code INTO v_code FROM public.discounts WHERE id = v_id AND organization_id = p_org;
  END IF;

  IF NULLIF(btrim(p_discount->>'name'), '') IS NULL THEN
    RAISE EXCEPTION 'Name is required' USING ERRCODE = 'P0001';
  END IF;
  IF v_method = 'code' AND v_code IS NULL THEN
    RAISE EXCEPTION 'A code is required' USING ERRCODE = 'P0001';
  END IF;
  IF v_method = 'automatic' THEN
    v_code := NULL;
  END IF;
  IF v_target = 'order' THEN
    v_applies := 'all';
  END IF;
  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.discounts
    WHERE organization_id = p_org AND archived_at IS NULL
      AND lower(code) = lower(v_code) AND id IS DISTINCT FROM v_id
  ) THEN
    RAISE EXCEPTION 'Code % is already used by another discount', v_code USING ERRCODE = 'P0001', HINT = 'code_taken';
  END IF;
  IF v_applies <> 'all' AND jsonb_array_length(COALESCE(p_discount->'targets', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Pick at least one %', CASE WHEN v_applies = 'categories' THEN 'category' ELSE 'product' END
      USING ERRCODE = 'P0001';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.discounts (organization_id, name, value, created_by)
    VALUES (p_org, btrim(p_discount->>'name'), 0, auth.uid())
    RETURNING id INTO v_id;
  ELSIF NOT EXISTS (SELECT 1 FROM public.discounts WHERE id = v_id AND organization_id = p_org AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Discount not found';
  END IF;

  UPDATE public.discounts SET
    name = btrim(p_discount->>'name'),
    description = NULLIF(btrim(p_discount->>'description'), ''),
    method = v_method,
    code = v_code,
    target = v_target,
    value_type = COALESCE(p_discount->>'value_type', 'percentage'),
    value = COALESCE((p_discount->>'value')::NUMERIC, 0),
    once_per_order = COALESCE((p_discount->>'once_per_order')::BOOLEAN, FALSE),
    applies_to = v_applies,
    min_subtotal = NULLIF(p_discount->>'min_subtotal', '')::NUMERIC,
    min_quantity = NULLIF(p_discount->>'min_quantity', '')::NUMERIC,
    branch_ids = (SELECT NULLIF(array_agg(x::UUID), '{}') FROM jsonb_array_elements_text(COALESCE(p_discount->'branch_ids', '[]'::jsonb)) x),
    customer_ids = (SELECT NULLIF(array_agg(x::UUID), '{}') FROM jsonb_array_elements_text(COALESCE(p_discount->'customer_ids', '[]'::jsonb)) x),
    starts_at = NULLIF(p_discount->>'starts_at', '')::TIMESTAMPTZ,
    ends_at = NULLIF(p_discount->>'ends_at', '')::TIMESTAMPTZ,
    usage_limit = NULLIF(p_discount->>'usage_limit', '')::INTEGER,
    usage_limit_per_customer = NULLIF(p_discount->>'usage_limit_per_customer', '')::INTEGER,
    combinable = COALESCE((p_discount->>'combinable')::BOOLEAN, FALSE),
    is_active = COALESCE((p_discount->>'is_active')::BOOLEAN, is_active),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = v_id;

  DELETE FROM public.discount_targets WHERE discount_id = v_id;

  IF v_applies = 'categories' THEN
    INSERT INTO public.discount_targets (organization_id, discount_id, category_id)
    SELECT DISTINCT p_org, v_id, c.id
    FROM jsonb_array_elements(p_discount->'targets') t
    JOIN public.product_categories c ON c.id = NULLIF(t->>'category_id', '')::UUID AND c.organization_id = p_org;
  ELSIF v_applies = 'products' THEN
    INSERT INTO public.discount_targets (organization_id, discount_id, product_id, variant_id)
    SELECT DISTINCT p_org, v_id, p.id, v.id
    FROM jsonb_array_elements(p_discount->'targets') t
    JOIN public.products p ON p.id = NULLIF(t->>'product_id', '')::UUID AND p.organization_id = p_org
    LEFT JOIN public.product_variants v ON v.id = NULLIF(t->>'variant_id', '')::UUID AND v.product_id = p.id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_discount_active(p_id UUID, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.discounts WHERE id = p_id AND archived_at IS NULL;
  IF v_org IS NULL OR NOT public.user_can(v_org, 'discounts', 'edit') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.discounts SET is_active = p_active, updated_by = auth.uid(), updated_at = now() WHERE id = p_id;
END;
$$;

-- Deleting keeps the row (sales still point at it) but hides it and frees its code.
CREATE OR REPLACE FUNCTION public.archive_discount(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.discounts WHERE id = p_id AND archived_at IS NULL;
  IF v_org IS NULL OR NOT public.user_can(v_org, 'discounts', 'delete') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.discounts
  SET archived_at = now(), is_active = FALSE, updated_by = auth.uid(), updated_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_can(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_discounts(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_discount(UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_discount_active(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_discount(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_discounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_discount(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_discount_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_discount(UUID) TO authenticated;
