-- Custom options and editable option types/values.
--
-- A custom option is a product variant named in free text ("NXRF140",
-- "Red XL 2023") instead of by option values. Until now these existed only as
-- stock rows (inventory.type = 'custom' with a custom_label), one per branch,
-- unrelated to each other. This turns each product + label into one custom
-- variant and links the existing stock rows to it:
--   * quantities, prices, stock row ids and inventory numbers don't change
--   * inventory.custom_label stays filled (kept equal to the option's name),
--     so reports and older app versions keep showing the same name
--   * past sale lines and stock history of those rows get the variant id, so
--     reports group old and new sales of an option together
--
-- Older app versions keep working: stock rows they create or rename with a
-- label are linked to the matching custom option by a trigger, and saving a
-- product from them never archives custom options.
--
-- Also adds rename/archive for option types and values. Variants store option
-- names (not ids) in attributes, so renames update every variant using them.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS custom_label TEXT;
ALTER TABLE public.variation_types ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.variation_options ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- One active custom option per name per product (case and outer spaces ignored).
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_custom_label_key
  ON public.product_variants (product_id, lower(btrim(custom_label)))
  WHERE custom_label IS NOT NULL AND is_deleted = FALSE;


-- ---------------------------------------------------------------------------
-- 2. Convert existing custom stock rows
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _custom_options ON COMMIT DROP AS
SELECT
  i.product_id,
  i.organization_id,
  lower(btrim(i.custom_label)) AS label_key,
  -- spelling of the row with the most stock
  (array_agg(btrim(i.custom_label) ORDER BY i.quantity DESC, i.last_updated DESC NULLS LAST, i.id))[1] AS label,
  (array_agg(i.created_by ORDER BY i.last_updated NULLS LAST, i.id) FILTER (WHERE i.created_by IS NOT NULL))[1] AS created_by,
  NULL::UUID AS variant_id
FROM public.inventory i
WHERE i.is_deleted = FALSE
  AND i.variant_id IS NULL
  AND NULLIF(btrim(i.custom_label), '') IS NOT NULL
GROUP BY i.product_id, i.organization_id, lower(btrim(i.custom_label));

UPDATE _custom_options SET variant_id = gen_random_uuid();

-- Keep who last edited the stock rows; the audit trigger would blank it.
ALTER TABLE public.inventory DISABLE TRIGGER set_audit_fields_inventory;

INSERT INTO public.product_variants (id, product_id, organization_id, custom_label, attributes, price, sku, created_by)
SELECT variant_id, product_id, organization_id, label, '{}'::jsonb, NULL, NULL, created_by
FROM _custom_options;

UPDATE public.inventory i
SET variant_id = c.variant_id,
    custom_label = c.label
FROM _custom_options c
WHERE i.product_id = c.product_id
  AND i.is_deleted = FALSE
  AND i.variant_id IS NULL
  AND lower(btrim(i.custom_label)) = c.label_key;

ALTER TABLE public.inventory ENABLE TRIGGER set_audit_fields_inventory;

UPDATE public.order_items oi
SET variant_id = i.variant_id
FROM public.inventory i, _custom_options c
WHERE oi.inventory_id = i.id
  AND i.variant_id = c.variant_id
  AND oi.variant_id IS NULL;

UPDATE public.stock_movements m
SET variant_id = i.variant_id
FROM public.inventory i, _custom_options c
WHERE m.inventory_id = i.id
  AND i.variant_id = c.variant_id
  AND m.variant_id IS NULL;

UPDATE public.products p
SET has_variations = TRUE
WHERE p.id IN (SELECT product_id FROM _custom_options)
  AND p.has_variations IS DISTINCT FROM TRUE;


-- ---------------------------------------------------------------------------
-- 3. Keeping stock rows and custom options linked
-- ---------------------------------------------------------------------------

-- The product's custom option with this name, creating it (or bringing back
-- an archived one) when there is none.
CREATE OR REPLACE FUNCTION public.custom_option_id(p_product_id UUID, p_label TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_label TEXT := NULLIF(btrim(p_label), '');
  v_id UUID;
  v_org UUID;
BEGIN
  IF v_label IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.product_variants
  WHERE product_id = p_product_id
    AND custom_label IS NOT NULL
    AND lower(btrim(custom_label)) = lower(v_label)
  ORDER BY is_deleted, updated_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.product_variants SET is_deleted = FALSE, updated_at = now()
    WHERE id = v_id AND is_deleted;
    RETURN v_id;
  END IF;

  SELECT organization_id INTO v_org FROM public.products WHERE id = p_product_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  INSERT INTO public.product_variants (product_id, organization_id, custom_label, attributes)
  VALUES (p_product_id, v_org, v_label, '{}'::jsonb)
  RETURNING id INTO v_id;

  UPDATE public.products SET has_variations = TRUE
  WHERE id = p_product_id AND has_variations IS DISTINCT FROM TRUE;

  RETURN v_id;
END;
$$;

-- Stock rows written by older app versions (label, no variant) are linked to
-- the custom option of that name. Renaming a linked row's label (older
-- versions) moves it to the option with the new name, as it did before.
-- Otherwise a row of a custom option always carries the option's name.
CREATE OR REPLACE FUNCTION public.link_custom_stock_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_option_label TEXT;
BEGIN
  IF NEW.is_deleted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.variant_id IS NOT DISTINCT FROM OLD.variant_id
     AND NEW.custom_label IS DISTINCT FROM OLD.custom_label
     AND OLD.variant_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.product_variants WHERE id = OLD.variant_id AND custom_label IS NOT NULL)
  THEN
    -- A rename that came from the option itself keeps the link.
    SELECT custom_label INTO v_option_label FROM public.product_variants WHERE id = OLD.variant_id;
    IF v_option_label IS DISTINCT FROM NEW.custom_label THEN
      NEW.variant_id := public.custom_option_id(NEW.product_id, NEW.custom_label);
      IF NEW.variant_id IS NULL THEN
        NEW.custom_label := NULL;
      END IF;
    END IF;
  END IF;

  IF NEW.variant_id IS NULL THEN
    IF NULLIF(btrim(NEW.custom_label), '') IS NOT NULL THEN
      NEW.variant_id := public.custom_option_id(NEW.product_id, NEW.custom_label);
    END IF;
  END IF;

  IF NEW.variant_id IS NOT NULL THEN
    SELECT custom_label INTO v_option_label FROM public.product_variants WHERE id = NEW.variant_id;
    IF v_option_label IS NOT NULL THEN
      NEW.custom_label := v_option_label;
      NEW.type := 'custom';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_custom_stock_row ON public.inventory;
CREATE TRIGGER link_custom_stock_row
  BEFORE INSERT OR UPDATE OF variant_id, custom_label, is_deleted ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.link_custom_stock_row();

-- Renaming a custom option renames its stock rows.
CREATE OR REPLACE FUNCTION public.sync_custom_option_label()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.inventory
  SET custom_label = NEW.custom_label
  WHERE variant_id = NEW.id
    AND custom_label IS DISTINCT FROM NEW.custom_label;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_custom_option_label ON public.product_variants;
CREATE TRIGGER sync_custom_option_label
  AFTER UPDATE OF custom_label ON public.product_variants
  FOR EACH ROW
  WHEN (NEW.custom_label IS NOT NULL AND NEW.custom_label IS DISTINCT FROM OLD.custom_label)
  EXECUTE FUNCTION public.sync_custom_option_label();

-- A custom option's name can't be blank.
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_custom_label_check;
ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_custom_label_check
  CHECK (custom_label IS NULL OR btrim(custom_label) <> '');


-- ---------------------------------------------------------------------------
-- 4. Stock row lookup: a variant (custom or not) identifies the row by itself
-- ---------------------------------------------------------------------------

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
  v_variant UUID := COALESCE(p_variant_id, public.custom_option_id(p_product_id, p_label));
  v_id UUID;
  v_org UUID;
BEGIN
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'A branch is required for stock';
  END IF;

  SELECT i.id INTO v_id
  FROM public.inventory i
  WHERE i.product_id = p_product_id
    AND i.variant_id IS NOT DISTINCT FROM v_variant
    AND i.branch_id = p_branch_id
    AND (v_variant IS NOT NULL OR COALESCE(i.custom_label, '') = '')
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

  -- link_custom_stock_row fills the label and type of custom options.
  INSERT INTO public.inventory (product_id, variant_id, branch_id, organization_id, quantity, type)
  VALUES (
    p_product_id, v_variant, p_branch_id, v_org, 0,
    CASE WHEN v_variant IS NULL THEN 'custom' ELSE 'variant' END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ---------------------------------------------------------------------------
-- 5. save_product with custom options
--
--   p_variants NULL = leave option variants alone
--              [{ id?, key?, sku, price, attributes }] option variants; ids
--              not listed are archived with their stock rows
--   p_custom   NULL = leave custom options alone
--              [{ id?, key?, label, sku?, price? }] custom options; ids not
--              listed are archived with their stock rows
--   p_stock    [{ branch_id, variant_id? | variant_key?, quantity?,
--                 min_stock_level?, price_override? }]
--
-- Custom options are never archived through p_variants, so saving from an
-- older app version (which only knows option variants) leaves them alone.
-- Returns { product_id, variants: { key-or-id: variant_id } }.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.save_product(JSONB, JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.save_product(
  p_product JSONB,
  p_variants JSONB DEFAULT NULL,
  p_stock JSONB DEFAULT NULL,
  p_custom JSONB DEFAULT NULL
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
  v_label TEXT;
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
      p_product,
      ARRAY['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_deleted', 'has_variations']
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

  -- Option variants
  IF p_variants IS NOT NULL THEN
    v_keep := '{}';
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
            attributes = CASE WHEN custom_label IS NULL THEN v_variant->'attributes' ELSE attributes END,
            is_deleted = FALSE,
            updated_at = now()
        WHERE id = v_variant_id AND product_id = v_product_id;
      END IF;

      v_keep := v_keep || v_variant_id;
      v_map := v_map || jsonb_build_object(COALESCE(NULLIF(v_variant->>'key', ''), v_variant_id::TEXT), v_variant_id);
    END LOOP;

    SELECT array_agg(id) INTO v_archived
    FROM public.product_variants
    WHERE product_id = v_product_id AND is_deleted = FALSE
      AND custom_label IS NULL
      AND NOT (id = ANY (v_keep));

    IF v_archived IS NOT NULL THEN
      UPDATE public.product_variants SET is_deleted = TRUE, updated_at = now() WHERE id = ANY (v_archived);
      UPDATE public.inventory SET is_deleted = TRUE WHERE variant_id = ANY (v_archived);
    END IF;
  END IF;

  -- Custom options
  IF p_custom IS NOT NULL THEN
    v_keep := '{}';
    FOR v_variant IN SELECT * FROM jsonb_array_elements(p_custom) LOOP
      v_variant_id := NULLIF(v_variant->>'id', '')::UUID;
      v_label := NULLIF(btrim(v_variant->>'label'), '');

      IF v_label IS NULL THEN
        RAISE EXCEPTION 'A custom option needs a name';
      END IF;

      IF v_variant_id IS NULL THEN
        INSERT INTO public.product_variants (product_id, organization_id, custom_label, attributes, sku, price)
        VALUES (v_product_id, v_org, v_label, '{}'::jsonb, NULLIF(v_variant->>'sku', ''), NULLIF(v_variant->>'price', '')::NUMERIC)
        RETURNING id INTO v_variant_id;
      ELSE
        UPDATE public.product_variants
        SET custom_label = v_label,
            sku = CASE WHEN v_variant ? 'sku' THEN NULLIF(v_variant->>'sku', '') ELSE sku END,
            price = CASE WHEN v_variant ? 'price' THEN NULLIF(v_variant->>'price', '')::NUMERIC ELSE price END,
            is_deleted = FALSE,
            updated_at = now()
        WHERE id = v_variant_id AND product_id = v_product_id AND custom_label IS NOT NULL;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Custom option % not found', v_variant_id;
        END IF;
      END IF;

      v_keep := v_keep || v_variant_id;
      v_map := v_map || jsonb_build_object(COALESCE(NULLIF(v_variant->>'key', ''), v_variant_id::TEXT), v_variant_id);
    END LOOP;

    SELECT array_agg(id) INTO v_archived
    FROM public.product_variants
    WHERE product_id = v_product_id AND is_deleted = FALSE
      AND custom_label IS NOT NULL
      AND NOT (id = ANY (v_keep));

    IF v_archived IS NOT NULL THEN
      UPDATE public.product_variants SET is_deleted = TRUE, updated_at = now() WHERE id = ANY (v_archived);
      UPDATE public.inventory SET is_deleted = TRUE WHERE variant_id = ANY (v_archived);
    END IF;
  END IF;

  IF p_variants IS NOT NULL OR p_custom IS NOT NULL THEN
    UPDATE public.products
    SET has_variations = EXISTS (
      SELECT 1 FROM public.product_variants WHERE product_id = v_product_id AND is_deleted = FALSE
    )
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
          AND (v_variant_id IS NOT NULL OR COALESCE(i.custom_label, '') = '')
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

GRANT EXECUTE ON FUNCTION public.save_product(JSONB, JSONB, JSONB, JSONB) TO authenticated;


-- ---------------------------------------------------------------------------
-- 6. Rename and archive option types and values
--
-- Run as the caller (RLS applies). Renames update every variant of the
-- organization that uses the old name; past sale lines keep the name they
-- were sold under.
-- ---------------------------------------------------------------------------

-- Fails when a rename would give one product two variants with the same options.
CREATE OR REPLACE FUNCTION public.assert_unique_variant_options(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_product TEXT;
BEGIN
  SELECT p.name INTO v_product
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.organization_id = p_organization_id
    AND v.is_deleted = FALSE
    AND v.custom_label IS NULL
    AND v.attributes <> '{}'::jsonb
  GROUP BY p.id, p.name, v.attributes
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF v_product IS NOT NULL THEN
    RAISE EXCEPTION '"%" would have two variants with the same options', v_product;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_variation_type(p_type_id UUID, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_type public.variation_types;
  v_name TEXT := NULLIF(btrim(p_name), '');
BEGIN
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT * INTO v_type FROM public.variation_types WHERE id = p_type_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Option not found';
  END IF;

  IF v_type.name = v_name THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.variation_types
    WHERE organization_id IS NOT DISTINCT FROM v_type.organization_id
      AND id <> p_type_id
      AND lower(name) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'An option named "%" already exists', v_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE organization_id = v_type.organization_id
      AND is_deleted = FALSE
      AND attributes ? v_type.name
      AND attributes ? v_name
  ) THEN
    RAISE EXCEPTION 'Some variants already use an option named "%"', v_name;
  END IF;

  UPDATE public.variation_types SET name = v_name WHERE id = p_type_id;

  UPDATE public.product_variants
  SET attributes = (attributes - v_type.name) || jsonb_build_object(v_name, attributes->v_type.name),
      updated_at = now()
  WHERE organization_id = v_type.organization_id
    AND attributes ? v_type.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_variation_option(p_option_id UUID, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_option public.variation_options;
  v_type public.variation_types;
  v_value TEXT := NULLIF(btrim(p_value), '');
BEGIN
  IF v_value IS NULL THEN
    RAISE EXCEPTION 'Value is required';
  END IF;

  SELECT * INTO v_option FROM public.variation_options WHERE id = p_option_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Value not found';
  END IF;

  IF v_option.value = v_value THEN
    RETURN;
  END IF;

  SELECT * INTO v_type FROM public.variation_types WHERE id = v_option.variation_type_id;

  IF EXISTS (
    SELECT 1 FROM public.variation_options
    WHERE variation_type_id = v_option.variation_type_id
      AND id <> p_option_id
      AND lower(value) = lower(v_value)
  ) THEN
    RAISE EXCEPTION '"%" already has a value "%"', v_type.name, v_value;
  END IF;

  UPDATE public.variation_options SET value = v_value WHERE id = p_option_id;

  UPDATE public.product_variants
  SET attributes = jsonb_set(attributes, ARRAY[v_type.name], to_jsonb(v_value)),
      updated_at = now()
  WHERE organization_id = v_type.organization_id
    AND attributes->>v_type.name = v_option.value;

  PERFORM public.assert_unique_variant_options(v_type.organization_id);
END;
$$;

-- Archived types and values stay on the variants that use them but are no
-- longer offered for new ones.
CREATE OR REPLACE FUNCTION public.set_variation_archived(p_kind TEXT, p_id UUID, p_archived BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_kind = 'type' THEN
    UPDATE public.variation_types SET is_archived = p_archived WHERE id = p_id;
  ELSIF p_kind = 'option' THEN
    UPDATE public.variation_options SET is_archived = p_archived WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Unknown kind "%"', p_kind;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_variation_type(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_variation_option(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_variation_archived(TEXT, UUID, BOOLEAN) TO authenticated;


-- ---------------------------------------------------------------------------
-- 7. Discount targets name custom options
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  def TEXT := pg_get_functiondef('public.list_discounts'::regproc);
  old_expr TEXT := $x$(SELECT string_agg(val, ' / ') FROM jsonb_each_text(COALESCE(v.attributes, '{}'::jsonb)) a(k, val))$x$;
BEGIN
  IF position('v.custom_label' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_expr IN def) = 0 THEN
    RAISE EXCEPTION 'list_discounts: variant name expression not found';
  END IF;
  EXECUTE replace(def, old_expr, 'COALESCE(v.custom_label, ' || old_expr || ')');
END;
$$;
