-- Stock hotfix (v1.1.6)
--
-- 1. Variants are archived instead of deleted. A hard delete cascades to
--    inventory (inventory_variant_id_fkey ON DELETE CASCADE) and clears
--    order_items.variant_id, losing stock rows and sales links.
-- 2. Saving variants used to insert an inventory row with no branch for every
--    new variant. Those rows are invisible on the Inventory page but counted in
--    products_view totals. Archive the empty ones; rows holding stock are kept.

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS product_variants_product_id_active_idx
  ON public.product_variants (product_id)
  WHERE is_deleted = FALSE;

UPDATE public.inventory
SET is_deleted = TRUE
WHERE branch_id IS NULL
  AND variant_id IS NOT NULL
  AND COALESCE(quantity, 0) = 0
  AND is_deleted = FALSE;
