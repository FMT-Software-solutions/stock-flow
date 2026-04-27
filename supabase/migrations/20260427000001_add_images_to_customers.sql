-- Add images array to customers table for storing up to 3 customer pictures
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'::TEXT[];

-- Ensure RLS allows all authenticated users to access their own organization data
-- (The policy already exists on customers table, so no new policy is needed for the column itself)
