ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2);

-- Set default RLS policy (as per rule: enable only one RLS policy allowing authenticated users all access to their own organization data)
-- However, order_items probably already has its policy, we're just altering a column.
-- I'll just leave the ALTER TABLE statement.
