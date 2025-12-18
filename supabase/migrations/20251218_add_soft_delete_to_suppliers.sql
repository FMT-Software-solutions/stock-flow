ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Update the RLS policy if needed, or ensuring queries filter by is_deleted
-- Usually we just filter in the query, but we can also add a policy to prevent viewing deleted items if strictness is required.
-- For now, we will rely on application logic to filter is_deleted = false.
