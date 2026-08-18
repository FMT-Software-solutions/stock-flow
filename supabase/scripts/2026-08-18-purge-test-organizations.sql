-- =============================================================================
-- One-off cleanup: remove 8 test organizations from Stock Flow
--
-- Run in the Stock Flow Supabase SQL editor. Run STEP 1 on its own first and
-- read the output; only then run STEP 2.
--
-- Why this is short: every foreign key pointing at organizations(id) in this
-- project is ON DELETE CASCADE, so deleting the organization row removes its
-- products, orders, customers, inventory, SMS ledger, roles, branches and
-- memberships. There is no need to touch the 30+ org-scoped tables by name.
--
-- Users follow the rule: an account whose memberships lie entirely within the
-- purged organizations is removed; an account that also belongs elsewhere
-- keeps its login and loses only the membership, which the cascade handles.
-- =============================================================================


-- =============================================================================
-- STEP 1 — PREVIEW. Changes nothing. Read this before running STEP 2.
-- =============================================================================
WITH purge_orgs(id) AS (
  VALUES
    ('1bd5bc86-d749-4ddd-9356-6a4d21ee5782'::uuid),
    ('258c4815-19d9-4f51-b4b1-80e31e41f527'::uuid),
    ('4af2ec1e-f2ad-437d-ba7f-f868e46ebd15'::uuid),
    ('6f8d6053-d60a-4a1a-b945-461d9eb6a69a'::uuid),
    ('b2e8379b-25ed-4eda-911d-625bcbab75b3'::uuid),
    ('c065a15a-b7c5-42bd-bfe3-925a90e2f2b6'::uuid),
    ('d3f12672-d84d-48c5-923f-2a759e41e3ce'::uuid),
    ('d4646b18-8241-46f8-b345-71700b6e42c7'::uuid)
),
doomed_users AS (
  SELECT uo.user_id
  FROM public.user_organizations uo
  GROUP BY uo.user_id
  HAVING bool_and(uo.organization_id IN (SELECT id FROM purge_orgs))
)
SELECT
  'organization' AS kind,
  o.name         AS label,
  o.email        AS detail,
  jsonb_build_object(
    'purchased', o.has_purchased,
    'members',   (SELECT count(*) FROM public.user_organizations uo WHERE uo.organization_id = o.id),
    'orders',    (SELECT count(*) FROM public.orders     x WHERE x.organization_id = o.id),
    'products',  (SELECT count(*) FROM public.products   x WHERE x.organization_id = o.id),
    'customers', (SELECT count(*) FROM public.customers  x WHERE x.organization_id = o.id)
  ) AS info
FROM public.organizations o
WHERE o.id IN (SELECT id FROM purge_orgs)

UNION ALL
SELECT
  'user: DELETED ENTIRELY',
  coalesce(p.first_name || ' ' || p.last_name, '(no name)'),
  p.email,
  jsonb_build_object('memberships', (SELECT count(*) FROM public.user_organizations uo WHERE uo.user_id = p.id))
FROM public.profiles p
WHERE p.id IN (SELECT user_id FROM doomed_users)

UNION ALL
SELECT
  'user: KEPT (loses membership only)',
  coalesce(p.first_name || ' ' || p.last_name, '(no name)'),
  p.email,
  jsonb_build_object(
    'total_memberships',   (SELECT count(*) FROM public.user_organizations uo WHERE uo.user_id = p.id),
    'losing',              (SELECT count(*) FROM public.user_organizations uo
                            WHERE uo.user_id = p.id AND uo.organization_id IN (SELECT id FROM purge_orgs)),
    'keeping',             (SELECT count(*) FROM public.user_organizations uo
                            WHERE uo.user_id = p.id AND uo.organization_id NOT IN (SELECT id FROM purge_orgs))
  )
FROM public.profiles p
WHERE p.id IN (
        SELECT uo.user_id FROM public.user_organizations uo
        WHERE uo.organization_id IN (SELECT id FROM purge_orgs)
      )
  AND p.id NOT IN (SELECT user_id FROM doomed_users)

UNION ALL
SELECT
  'id not found in this project',
  x.id::text,
  NULL,
  '{}'::jsonb
FROM (SELECT id FROM purge_orgs) x
WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = x.id)
ORDER BY 1, 2;


-- =============================================================================
-- STEP 2 — DELETE. Runs as one transaction: any error rolls all of it back.
-- Select from BEGIN to COMMIT and run it together.
-- =============================================================================
BEGIN;

-- The organizations to remove.
CREATE TEMP TABLE _purge_orgs (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _purge_orgs (id) VALUES
  ('1bd5bc86-d749-4ddd-9356-6a4d21ee5782'),
  ('258c4815-19d9-4f51-b4b1-80e31e41f527'),
  ('4af2ec1e-f2ad-437d-ba7f-f868e46ebd15'),
  ('6f8d6053-d60a-4a1a-b945-461d9eb6a69a'),
  ('b2e8379b-25ed-4eda-911d-625bcbab75b3'),
  ('c065a15a-b7c5-42bd-bfe3-925a90e2f2b6'),
  ('d3f12672-d84d-48c5-923f-2a759e41e3ce'),
  ('d4646b18-8241-46f8-b345-71700b6e42c7');

-- Work out who loses their account BEFORE the delete: the cascade is about to
-- remove the very membership rows this depends on.
CREATE TEMP TABLE _doomed_users (user_id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _doomed_users (user_id)
SELECT uo.user_id
FROM public.user_organizations uo
GROUP BY uo.user_id
HAVING bool_and(uo.organization_id IN (SELECT id FROM _purge_orgs));

-- One delete; ON DELETE CASCADE removes everything belonging to these orgs,
-- including memberships for users who are staying.
DELETE FROM public.organizations WHERE id IN (SELECT id FROM _purge_orgs);

-- Accounts left with nothing. profiles and auth_users are cleared explicitly
-- so the result does not depend on how their constraints were defined.
DELETE FROM public.auth_users WHERE id IN (SELECT user_id FROM _doomed_users);
DELETE FROM public.profiles   WHERE id IN (SELECT user_id FROM _doomed_users);

-- Removes the login itself. Comment this line out to keep the auth accounts
-- (they would remain able to sign in, but belong to no organization).
DELETE FROM auth.users        WHERE id IN (SELECT user_id FROM _doomed_users);

-- Confirm before committing: expect 0 organizations and 0 memberships left.
SELECT
  (SELECT count(*) FROM public.organizations     WHERE id IN (SELECT id FROM _purge_orgs))                 AS orgs_remaining,
  (SELECT count(*) FROM public.user_organizations WHERE organization_id IN (SELECT id FROM _purge_orgs))   AS memberships_remaining,
  (SELECT count(*) FROM public.profiles          WHERE id IN (SELECT user_id FROM _doomed_users))          AS doomed_profiles_remaining,
  (SELECT count(*) FROM public.organizations)                                                              AS organizations_left_in_project;

COMMIT;
-- If anything above looks wrong, run ROLLBACK; instead of COMMIT;


-- =============================================================================
-- STEP 3 — verify afterwards
-- =============================================================================
-- SELECT id, name, created_at FROM public.organizations ORDER BY created_at;
