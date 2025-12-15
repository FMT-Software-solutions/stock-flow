-- Add branch_id to core tables that are branch-dependent
-- Note: configuration tables like categories, variation types, and variation options
-- remain organization-wide only and do not receive a branch_id column.

-- Products: track which branch a product record is primarily managed from (when applicable)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS branch_id UUID;

-- Suppliers: allow associating suppliers with a specific branch when needed
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS branch_id UUID;

