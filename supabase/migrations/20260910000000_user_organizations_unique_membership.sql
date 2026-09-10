-- Unique membership per user per organization.
--
-- The create-organization-owner edge function upserts the owner membership
-- with ON CONFLICT (user_id, organization_id), which requires a matching
-- unique constraint. Without it every new-customer provisioning fails with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" and the function rolls the organization back.
--
-- Idempotent: safe to run more than once. Refuses to run if duplicate
-- memberships exist, since the constraint could not be created over them.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_organizations
    GROUP BY user_id, organization_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate (user_id, organization_id) memberships exist; resolve them before adding the constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_organizations'::regclass
      AND conname = 'user_organizations_user_id_organization_id_key'
  ) THEN
    ALTER TABLE public.user_organizations
      ADD CONSTRAINT user_organizations_user_id_organization_id_key
      UNIQUE (user_id, organization_id);
  END IF;
END $$;
