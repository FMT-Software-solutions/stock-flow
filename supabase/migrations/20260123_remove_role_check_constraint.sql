-- Remove the check constraint on the role column to allow custom roles
ALTER TABLE public.user_organizations DROP CONSTRAINT IF EXISTS user_organizations_role_check;
