-- Stock foundations
--
-- Additive only: existing products keep tracking stock, existing inventory
-- rows are untouched, and the current app keeps working unchanged.
--
--   1. products.track_stock      products that are sold without stock (food, services)
--   2. stock_movements           append-only history of every inventory quantity change
--   3. log_stock_movement        trigger on inventory that writes that history
--   4. sale triggers             now tag their stock changes as sale / sale_reversal
--   5. save_product              product + variants + opening stock in one transaction
--   6. adjust_stock              reasoned stock changes (received, count, damaged, ...)
--   7. create_order              order + items + stock check + discount use in one transaction
--
-- All RPCs are SECURITY INVOKER, so the existing organization RLS still decides
-- what a caller can touch. Only the logging trigger (SECURITY DEFINER) can write
-- stock_movements.


-- ---------------------------------------------------------------------------
-- 1. products.track_stock
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT TRUE;

-- Same definition as 20260123_fix_products_view_description.sql with
-- track_stock appended (CREATE OR REPLACE VIEW may only add columns at the end).
CREATE OR REPLACE VIEW public.products_view AS
SELECT
    p.id,
    p.name,
    p.sku,
    p.category_id,
    p.supplier_id,
    p.brand,
    p.cost_price,
    p.selling_price,
    p.unit,
    p.status,
    p.image_url,
    p.additional_images,
    p.tax_rate,
    p.barcode,
    p.discount,
    p.organization_id,
    p.created_at,
    p.updated_at,
    p.has_variations,
    p.is_deleted,
    p.description,
    pc.name as category_name,
    s.name as supplier_name,
    pr.first_name || ' ' || pr.last_name as created_by_name,
    COALESCE(SUM(i.quantity), 0) as quantity,
    COALESCE(MIN(i.min_stock_level), 0) as min_stock_level,
    MAX(i.location) as location,
    p.track_stock
FROM
    products p
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN inventory i ON p.id = i.product_id AND i.is_deleted = FALSE
    LEFT JOIN profiles pr ON p.created_by = pr.id
GROUP BY
    p.id,
    pc.name,
    s.name,
    pr.first_name,
    pr.last_name,
    p.is_deleted,
    p.description;

GRANT SELECT ON public.products_view TO authenticated;
GRANT SELECT ON public.products_view TO service_role;


-- ---------------------------------------------------------------------------
-- 2. stock_movements
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    change NUMERIC(12, 2) NOT NULL,
    quantity_before NUMERIC(12, 2) NOT NULL,
    quantity_after NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN (
        'opening',        -- first stock when a row is created
        'received',       -- delivery / restock
        'count',          -- stock count set the quantity
        'damaged',        -- written off
        'correction',     -- manual fix
        'return',         -- customer returned goods to stock
        'sale',           -- sold (order item created, order restored)
        'sale_reversal',  -- sale undone (item removed, order cancelled/refunded/deleted)
        'edit',           -- changed directly, outside the RPCs
        'other'
    )),
    note TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_inventory_idx
    ON public.stock_movements (inventory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx
    ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_org_idx
    ON public.stock_movements (organization_id, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Read-only for members. No insert/update/delete policy on purpose: rows are
-- written only by log_stock_movement() and are never edited.
DROP POLICY IF EXISTS "Org users read stock movements" ON public.stock_movements;
CREATE POLICY "Org users read stock movements" ON public.stock_movements
  FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

GRANT SELECT ON public.stock_movements TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. Logging trigger
--
-- Callers describe a change by setting transaction-local settings before they
-- touch inventory.quantity:
--   stock.reason    one of the reasons above (default: opening / edit)
--   stock.note      free text
--   stock.order_id  the order behind a sale
-- set_stock_context() sets all three; clear_stock_context() resets them so a
-- later change in the same transaction is not mislabelled.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_stock_context(p_reason TEXT, p_note TEXT DEFAULT NULL, p_order_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
AS $$
  SELECT set_config('stock.reason', COALESCE(p_reason, ''), true),
         set_config('stock.note', COALESCE(p_note, ''), true),
         set_config('stock.order_id', COALESCE(p_order_id::text, ''), true);
$$;

CREATE OR REPLACE FUNCTION public.clear_stock_context()
RETURNS VOID
LANGUAGE sql
AS $$
  SELECT public.set_stock_context(NULL, NULL, NULL);
$$;

CREATE OR REPLACE FUNCTION public.log_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before NUMERIC := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE COALESCE(OLD.quantity, 0) END;
  v_after NUMERIC := COALESCE(NEW.quantity, 0);
  v_reason TEXT := NULLIF(current_setting('stock.reason', true), '');
BEGIN
  IF v_after = v_before THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.stock_movements (
    organization_id, inventory_id, product_id, variant_id, branch_id,
    change, quantity_before, quantity_after, reason, note, order_id, created_by
  ) VALUES (
    NEW.organization_id, NEW.id, NEW.product_id, NEW.variant_id, NEW.branch_id,
    v_after - v_before, v_before, v_after,
    COALESCE(v_reason, CASE WHEN TG_OP = 'INSERT' THEN 'opening' ELSE 'edit' END),
    NULLIF(current_setting('stock.note', true), ''),
    NULLIF(current_setting('stock.order_id', true), '')::UUID,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_stock_movement ON public.inventory;
CREATE TRIGGER trigger_log_stock_movement
AFTER INSERT OR UPDATE OF quantity ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.log_stock_movement();


-- ---------------------------------------------------------------------------
-- 4. Sale triggers: same stock behaviour as 20251219_order_stock_trigger.sql
--    and 20260428_handle_order_soft_delete_stock.sql, now labelled.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_inventory_on_order_item_create()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.inventory_id IS NOT NULL THEN
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
    IF OLD.inventory_id IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    IF (NEW.status = 'cancelled' OR NEW.status = 'refunded') AND (OLD.status != 'cancelled' AND OLD.status != 'refunded') THEN
        PERFORM public.set_stock_context('sale_reversal', 'Order ' || NEW.status, NEW.id);
        FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
            IF item.inventory_id IS NOT NULL THEN
                UPDATE public.inventory
                SET quantity = quantity + item.quantity,
                    last_updated = now()
                WHERE id = item.inventory_id;
            END IF;
        END LOOP;
        PERFORM public.clear_stock_context();
    END IF;

    IF (OLD.status = 'cancelled' OR OLD.status = 'refunded') AND (NEW.status != 'cancelled' AND NEW.status != 'refunded') THEN
        PERFORM public.set_stock_context('sale', 'Order reopened', NEW.id);
        FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
            IF item.inventory_id IS NOT NULL THEN
                UPDATE public.inventory
                SET quantity = quantity - item.quantity,
                    last_updated = now()
                WHERE id = item.inventory_id;
            END IF;
        END LOOP;
        PERFORM public.clear_stock_context();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_order_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    IF NEW.is_deleted = TRUE AND OLD.is_deleted = FALSE THEN
        IF OLD.status != 'cancelled' AND OLD.status != 'refunded' THEN
            PERFORM public.set_stock_context('sale_reversal', 'Order deleted', NEW.id);
            FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
                IF item.inventory_id IS NOT NULL THEN
                    UPDATE public.inventory
                    SET quantity = quantity + item.quantity,
                        last_updated = now()
                    WHERE id = item.inventory_id;
                END IF;
            END LOOP;
            PERFORM public.clear_stock_context();
        END IF;
    END IF;

    IF NEW.is_deleted = FALSE AND OLD.is_deleted = TRUE THEN
        IF NEW.status != 'cancelled' AND NEW.status != 'refunded' THEN
            PERFORM public.set_stock_context('sale', 'Order restored', NEW.id);
            FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
                IF item.inventory_id IS NOT NULL THEN
                    UPDATE public.inventory
                    SET quantity = quantity - item.quantity,
                        last_updated = now()
                    WHERE id = item.inventory_id;
                END IF;
            END LOOP;
            PERFORM public.clear_stock_context();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- Helper: insert one row from JSON, using only keys that are real columns.
-- Unknown keys are ignored and omitted columns keep their defaults, so the
-- client can keep sending the payloads it already builds. SECURITY INVOKER:
-- RLS applies exactly as for a direct insert.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.insert_row_from_jsonb(p_table TEXT, p_row JSONB, p_exclude TEXT[] DEFAULT '{}')
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cols TEXT;
  v_result JSONB;
BEGIN
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table
    AND c.column_name IN (SELECT jsonb_object_keys(p_row))
    AND NOT (c.column_name = ANY (p_exclude));

  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'Nothing to insert into %', p_table;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1) RETURNING to_jsonb(%1$I.*)',
    p_table, v_cols
  ) USING p_row INTO v_result;

  RETURN v_result;
END;
$$;

-- Finds the active stock row for product/variant/branch/label, creating an
-- empty one when there is none. Unlabelled rows of a product without variants
-- were historically stored as type 'custom' with '' or NULL as the label, so
-- both count as "no label". If a branch has several such rows, the one with
-- the most stock is used; the others stay as they are.
CREATE OR REPLACE FUNCTION public.find_or_create_stock_row(
  p_product_id UUID,
  p_variant_id UUID,
  p_branch_id UUID,
  p_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_org UUID;
BEGIN
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'A branch is required for stock';
  END IF;

  SELECT i.id INTO v_id
  FROM public.inventory i
  WHERE i.product_id = p_product_id
    AND i.variant_id IS NOT DISTINCT FROM p_variant_id
    AND i.branch_id = p_branch_id
    AND COALESCE(i.custom_label, '') = COALESCE(p_label, '')
    AND i.is_deleted = FALSE
  ORDER BY i.quantity DESC, i.id
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT organization_id INTO v_org FROM public.products WHERE id = p_product_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  INSERT INTO public.inventory (product_id, variant_id, branch_id, organization_id, quantity, custom_label, type)
  VALUES (
    p_product_id, p_variant_id, p_branch_id, v_org, 0,
    NULLIF(p_label, ''),
    CASE WHEN p_variant_id IS NULL THEN 'custom' ELSE 'variant' END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Sets or changes one stock row's quantity with a reason, logging it.
CREATE OR REPLACE FUNCTION public.apply_stock_change(
  p_inventory_id UUID,
  p_change NUMERIC,
  p_quantity NUMERIC,
  p_reason TEXT,
  p_note TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_current NUMERIC;
  v_next NUMERIC;
BEGIN
  SELECT quantity INTO v_current
  FROM public.inventory
  WHERE id = p_inventory_id AND is_deleted = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock row % not found', p_inventory_id;
  END IF;

  IF p_quantity IS NOT NULL THEN
    v_next := p_quantity;
  ELSIF p_change IS NOT NULL THEN
    v_next := COALESCE(v_current, 0) + p_change;
  ELSE
    RETURN v_current;
  END IF;

  IF v_next < 0 THEN
    RAISE EXCEPTION 'Stock cannot go below zero (currently %, change would make it %)', v_current, v_next;
  END IF;

  IF v_next IS DISTINCT FROM v_current THEN
    PERFORM public.set_stock_context(p_reason, p_note, NULL);
    UPDATE public.inventory
    SET quantity = v_next, last_updated = now()
    WHERE id = p_inventory_id;
    PERFORM public.clear_stock_context();
  END IF;

  RETURN v_next;
END;
$$;


-- ---------------------------------------------------------------------------
-- 5. save_product
--
--   p_product  product fields; include "id" to update, omit it to create
--   p_variants NULL = leave variants alone
--              []   = product has no variants (archives any it had)
--              [{ id?, key?, sku, price, attributes }]
--                   ids not listed are archived with their stock rows;
--                   "key" is a client-side handle stock rows can refer to
--   p_stock    [{ branch_id, variant_id? | variant_key?, quantity, min_stock_level?, price_override? }]
--              sets quantities; new rows log 'opening', changed ones 'correction'
--
-- Returns { product_id, variants: { key-or-id: variant_id } }.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_product(
  p_product JSONB,
  p_variants JSONB DEFAULT NULL,
  p_stock JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id UUID := NULLIF(p_product->>'id', '')::UUID;
  v_org UUID;
  v_track BOOLEAN;
  v_variant JSONB;
  v_variant_id UUID;
  v_keep UUID[] := '{}';
  v_map JSONB := '{}';
  v_archived UUID[];
  v_row JSONB;
  v_inv UUID;
  v_existing BOOLEAN;
  v_editable TEXT[] := ARRAY[
    'name', 'sku', 'description', 'category_id', 'supplier_id', 'brand',
    'cost_price', 'selling_price', 'unit', 'status', 'image_url',
    'additional_images', 'tax_rate', 'barcode', 'discount', 'track_stock'
  ];
  v_sets TEXT;
BEGIN
  IF v_product_id IS NULL THEN
    v_product_id := (public.insert_row_from_jsonb(
      'products',
      p_product || jsonb_build_object('has_variations', COALESCE(jsonb_array_length(p_variants), 0) > 0),
      ARRAY['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_deleted']
    )->>'id')::UUID;
  ELSE
    SELECT string_agg(format('%1$I = r.%1$I', k), ', ')
    INTO v_sets
    FROM jsonb_object_keys(p_product) k
    WHERE k = ANY (v_editable);

    IF v_sets IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.products p SET %s, updated_at = now() FROM jsonb_populate_record(NULL::public.products, $1) r WHERE p.id = $2',
        v_sets
      ) USING p_product, v_product_id;
    END IF;
  END IF;

  SELECT organization_id, track_stock INTO v_org, v_track
  FROM public.products
  WHERE id = v_product_id AND is_deleted = FALSE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Product % not found', v_product_id;
  END IF;

  -- Variants
  IF p_variants IS NOT NULL THEN
    FOR v_variant IN SELECT * FROM jsonb_array_elements(p_variants) LOOP
      v_variant_id := NULLIF(v_variant->>'id', '')::UUID;

      IF v_variant_id IS NULL THEN
        INSERT INTO public.product_variants (product_id, sku, price, attributes, organization_id)
        VALUES (v_product_id, v_variant->>'sku', (v_variant->>'price')::NUMERIC, v_variant->'attributes', v_org)
        RETURNING id INTO v_variant_id;
      ELSE
        UPDATE public.product_variants
        SET sku = v_variant->>'sku',
            price = (v_variant->>'price')::NUMERIC,
            attributes = v_variant->'attributes',
            is_deleted = FALSE,
            updated_at = now()
        WHERE id = v_variant_id AND product_id = v_product_id;
      END IF;

      v_keep := v_keep || v_variant_id;
      v_map := v_map || jsonb_build_object(COALESCE(NULLIF(v_variant->>'key', ''), v_variant_id::TEXT), v_variant_id);
    END LOOP;

    -- Archive (never delete) variants that were dropped, with their stock rows.
    SELECT array_agg(id) INTO v_archived
    FROM public.product_variants
    WHERE product_id = v_product_id AND is_deleted = FALSE AND NOT (id = ANY (v_keep));

    IF v_archived IS NOT NULL THEN
      UPDATE public.product_variants SET is_deleted = TRUE, updated_at = now() WHERE id = ANY (v_archived);
      UPDATE public.inventory SET is_deleted = TRUE WHERE variant_id = ANY (v_archived);
    END IF;

    UPDATE public.products
    SET has_variations = jsonb_array_length(p_variants) > 0
    WHERE id = v_product_id;
  END IF;

  -- Stock
  IF p_stock IS NOT NULL AND jsonb_array_length(p_stock) > 0 THEN
    IF NOT v_track THEN
      RAISE EXCEPTION 'This product does not track stock';
    END IF;

    FOR v_row IN SELECT * FROM jsonb_array_elements(p_stock) LOOP
      v_variant_id := COALESCE(
        NULLIF(v_row->>'variant_id', '')::UUID,
        (v_map->>(v_row->>'variant_key'))::UUID
      );

      SELECT EXISTS (
        SELECT 1 FROM public.inventory i
        WHERE i.product_id = v_product_id
          AND i.variant_id IS NOT DISTINCT FROM v_variant_id
          AND i.branch_id = (v_row->>'branch_id')::UUID
          AND COALESCE(i.custom_label, '') = ''
          AND i.is_deleted = FALSE
      ) INTO v_existing;

      v_inv := public.find_or_create_stock_row(v_product_id, v_variant_id, (v_row->>'branch_id')::UUID, NULL);

      IF v_row ? 'min_stock_level' OR v_row ? 'price_override' THEN
        UPDATE public.inventory
        SET min_stock_level = CASE WHEN v_row ? 'min_stock_level' THEN (v_row->>'min_stock_level')::NUMERIC ELSE min_stock_level END,
            price_override = CASE WHEN v_row ? 'price_override' THEN NULLIF(v_row->>'price_override', '')::NUMERIC ELSE price_override END
        WHERE id = v_inv;
      END IF;

      IF v_row ? 'quantity' THEN
        PERFORM public.apply_stock_change(
          v_inv, NULL, (v_row->>'quantity')::NUMERIC,
          CASE WHEN v_existing THEN 'correction' ELSE 'opening' END,
          NULL
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('product_id', v_product_id, 'variants', v_map);
END;
$$;


-- ---------------------------------------------------------------------------
-- 6. adjust_stock
--
--   p_items  [{ inventory_id, change? | quantity? }]
--            or, to stock a branch/variant/label that has no row yet,
--            [{ product_id, variant_id?, branch_id, label?, change? | quantity? }]
--            "change" adds/subtracts, "quantity" sets (stock count)
--   p_reason received | count | damaged | correction | return | other
--
-- All items succeed or none do. Returns [{ inventory_id, quantity }].
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_items JSONB,
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_item JSONB;
  v_inv UUID;
  v_qty NUMERIC;
  v_result JSONB := '[]';
BEGIN
  IF p_reason NOT IN ('received', 'count', 'damaged', 'correction', 'return', 'other') THEN
    RAISE EXCEPTION 'Unknown stock reason "%"', p_reason;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN v_result;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_inv := NULLIF(v_item->>'inventory_id', '')::UUID;

    IF v_inv IS NULL THEN
      v_inv := public.find_or_create_stock_row(
        (v_item->>'product_id')::UUID,
        NULLIF(v_item->>'variant_id', '')::UUID,
        (v_item->>'branch_id')::UUID,
        v_item->>'label'
      );
    END IF;

    v_qty := public.apply_stock_change(
      v_inv,
      NULLIF(v_item->>'change', '')::NUMERIC,
      NULLIF(v_item->>'quantity', '')::NUMERIC,
      p_reason,
      p_note
    );

    v_result := v_result || jsonb_build_object('inventory_id', v_inv, 'quantity', v_qty);
  END LOOP;

  RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- 7. create_order
--
-- Replaces the client's two separate inserts (order, then items), which could
-- leave an order without items and only checked stock in the browser.
--
--   p_order        the orders payload the app already builds (unknown keys ignored)
--   p_items        the order_items payloads; inventory_id may be null for
--                  products that don't track stock
--   p_discount_id  counted against its usage limit in the same transaction
--
-- Stock rows are locked before checking, so two tills cannot both sell the
-- last unit. Stock itself is still deducted by the existing order_items trigger.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_order(
  p_order JSONB,
  p_items JSONB,
  p_discount_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order JSONB;
  v_order_id UUID;
  v_org UUID := (p_order->>'organization_id')::UUID;
  v_need RECORD;
  v_item JSONB;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  -- Lock and check every stock row the order draws from, in a stable order.
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
      AND organization_id = v_org
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

  v_order := public.insert_row_from_jsonb(
    'orders', p_order,
    ARRAY['id', 'order_number', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_deleted']
  );
  v_order_id := (v_order->>'id')::UUID;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]')) LOOP
    PERFORM public.insert_row_from_jsonb(
      'order_items',
      v_item || jsonb_build_object('order_id', v_order_id, 'organization_id', v_org),
      ARRAY['id', 'created_at']
    );
  END LOOP;

  IF p_discount_id IS NOT NULL THEN
    IF NOT public.increment_discount_usage(p_discount_id) THEN
      RAISE EXCEPTION 'This discount has reached its usage limit'
        USING ERRCODE = 'P0001', HINT = 'discount_limit';
    END IF;
  END IF;

  -- Re-read so values set by AFTER triggers (payments, totals) are included.
  SELECT to_jsonb(o.*) INTO v_order FROM public.orders o WHERE o.id = v_order_id;
  RETURN v_order;
END;
$$;

-- Helpers are building blocks for the RPCs above; keep them off the anon role.
REVOKE EXECUTE ON FUNCTION public.insert_row_from_jsonb(TEXT, JSONB, TEXT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_or_create_stock_row(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_stock_change(UUID, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_product(JSONB, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order(JSONB, JSONB, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_row_from_jsonb(TEXT, JSONB, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_stock_row(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stock_change(UUID, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_product(JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, JSONB, UUID) TO authenticated;
