-- Unique role name per organization.
--
-- The on_org_created_seed_roles trigger seeds default roles with
-- ON CONFLICT (organization_id, name), which requires a matching unique
-- constraint. 20251212_dynamic_roles_migration declared it inside
-- CREATE TABLE IF NOT EXISTS, so where the table already existed the
-- constraint was never created. Every organization insert then fails with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification", which broke provisioning of new customers.
--
-- Idempotent: safe to run more than once. Refuses to run if duplicate role
-- names exist, since the constraint could not be created over them.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.organization_roles
    GROUP BY organization_id, name
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate (organization_id, name) roles exist; resolve them before adding the constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.organization_roles'::regclass
      AND conname = 'organization_roles_organization_id_name_key'
  ) THEN
    ALTER TABLE public.organization_roles
      ADD CONSTRAINT organization_roles_organization_id_name_key
      UNIQUE (organization_id, name);
  END IF;
END $$;
