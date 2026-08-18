-- Purge organizations and everything belonging to them.
--
-- Intended for clearing out test organizations. Run in the Stock Flow
-- Supabase SQL editor, then call the function (see the bottom of this file).
--
-- How it works
-- ------------
-- Every foreign key pointing at organizations(id) in this project is
-- ON DELETE CASCADE, so deleting the organization row removes its products,
-- orders, customers, inventory, SMS ledger, memberships and the rest without
-- naming them. That matters: the schema has 30+ org-scoped tables and more
-- get added over time, so a hardcoded list would silently go stale.
--
-- The function still checks at runtime for any org-scoped table whose foreign
-- key is NOT cascading and clears those first, so a table added later without
-- ON DELETE CASCADE cannot make the purge fail halfway.
--
-- Users
-- -----
-- A user whose memberships lie entirely within the purged organizations is
-- removed completely: membership, profile, auth_users row and the auth.users
-- login. A user who also belongs to an organization outside the list keeps
-- their account; only their membership in the purged organizations goes,
-- which the cascade handles.
--
-- Safety
-- ------
-- p_dry_run defaults to TRUE. Nothing is deleted until it is called with
-- FALSE, and the dry run returns exactly what a real run would remove. The
-- whole thing runs in one transaction: any error rolls everything back.

CREATE OR REPLACE FUNCTION public.admin_purge_organizations(
  p_org_ids  uuid[],
  p_dry_run  boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_doomed_users   uuid[];
  v_kept_users     uuid[];
  v_org_names      text[];
  v_missing        uuid[];
  v_table_counts   jsonb := '{}'::jsonb;
  v_non_cascading  text[] := '{}';
  v_count          bigint;
  v_total_rows     bigint := 0;
  v_tbl            text;
  r                record;
BEGIN
  IF p_org_ids IS NULL OR array_length(p_org_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'p_org_ids must contain at least one organization id';
  END IF;

  -- Surface ids that do not exist rather than silently doing less than asked.
  SELECT array_agg(id) INTO v_missing
  FROM unnest(p_org_ids) AS id
  WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = id);

  SELECT array_agg(name ORDER BY name) INTO v_org_names
  FROM public.organizations WHERE id = ANY(p_org_ids);

  -- Users belonging ONLY to the targeted organizations.
  SELECT coalesce(array_agg(user_id), '{}') INTO v_doomed_users
  FROM (
    SELECT user_id
    FROM public.user_organizations
    GROUP BY user_id
    HAVING bool_and(organization_id = ANY(p_org_ids))
  ) s;

  -- Users who also belong elsewhere: they keep their account and lose only
  -- their membership in the targeted organizations.
  SELECT coalesce(array_agg(DISTINCT user_id), '{}') INTO v_kept_users
  FROM public.user_organizations
  WHERE organization_id = ANY(p_org_ids)
    AND NOT (user_id = ANY(v_doomed_users));

  -- Count what will go, per org-scoped table. Views are skipped: they have an
  -- organization_id column but nothing to delete.
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'organization_id'
      AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE organization_id = ANY($1)', r.table_name
    ) INTO v_count USING p_org_ids;

    IF v_count > 0 THEN
      v_table_counts := v_table_counts || jsonb_build_object(r.table_name, v_count);
      v_total_rows := v_total_rows + v_count;
    END IF;

    -- Any org-scoped table whose FK does not cascade must be cleared by hand.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class ch ON ch.oid = con.conrelid
      JOIN pg_class pa ON pa.oid = con.confrelid
      WHERE con.contype = 'f'
        AND ch.relname = r.table_name
        AND pa.relname = 'organizations'
        AND con.confdeltype = 'c'   -- 'c' = ON DELETE CASCADE
    ) THEN
      v_non_cascading := array_append(v_non_cascading, r.table_name);
    END IF;
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'organizations', coalesce(array_length(p_org_ids, 1), 0),
      'organization_names', to_jsonb(coalesce(v_org_names, '{}')),
      'ids_not_found', to_jsonb(coalesce(v_missing, '{}')),
      'users_to_delete', coalesce(array_length(v_doomed_users, 1), 0),
      'users_kept_membership_removed', coalesce(array_length(v_kept_users, 1), 0),
      'rows_to_delete', v_total_rows,
      'rows_by_table', v_table_counts,
      'tables_without_cascade', to_jsonb(v_non_cascading),
      'note', 'Nothing was deleted. Re-run with p_dry_run => false to apply.'
    );
  END IF;

  -- Clear tables that would otherwise block the cascade.
  FOREACH v_tbl IN ARRAY v_non_cascading LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE organization_id = ANY($1)', v_tbl
    ) USING p_org_ids;
  END LOOP;

  -- The cascade does the heavy lifting: every org-scoped row, including
  -- user_organizations and user_branches, goes with the organization.
  DELETE FROM public.organizations WHERE id = ANY(p_org_ids);

  -- Now remove the users left with nothing. profiles and auth_users are
  -- deleted explicitly rather than relying on their FK to auth.users, so the
  -- outcome does not depend on how those constraints were defined.
  IF array_length(v_doomed_users, 1) IS NOT NULL THEN
    DELETE FROM public.auth_users WHERE id = ANY(v_doomed_users);
    DELETE FROM public.profiles   WHERE id = ANY(v_doomed_users);
    DELETE FROM auth.users        WHERE id = ANY(v_doomed_users);
  END IF;

  RETURN jsonb_build_object(
    'dry_run', false,
    'organizations_deleted', coalesce(array_length(p_org_ids, 1), 0) - coalesce(array_length(v_missing, 1), 0),
    'organization_names', to_jsonb(coalesce(v_org_names, '{}')),
    'ids_not_found', to_jsonb(coalesce(v_missing, '{}')),
    'users_deleted', coalesce(array_length(v_doomed_users, 1), 0),
    'users_kept_membership_removed', coalesce(array_length(v_kept_users, 1), 0),
    'rows_deleted', v_total_rows,
    'rows_by_table', v_table_counts
  );
END;
$$;

-- Service role only. This deletes customer data; it must never be reachable
-- from a browser session.
REVOKE ALL ON FUNCTION public.admin_purge_organizations(uuid[], boolean) FROM public, anon, authenticated;


-- Companion view: find the organizations you are about to purge, with the
-- numbers that tell you whether it is safe.
CREATE OR REPLACE VIEW public.admin_organization_overview AS
SELECT
  o.id,
  o.name,
  o.email,
  o.is_active,
  o.has_purchased,
  o.created_at,
  (SELECT count(*) FROM public.user_organizations uo WHERE uo.organization_id = o.id)  AS members,
  (SELECT count(*) FROM public.orders     ord WHERE ord.organization_id     = o.id)    AS orders,
  (SELECT count(*) FROM public.products    p  WHERE p.organization_id       = o.id)    AS products,
  (SELECT count(*) FROM public.customers   c  WHERE c.organization_id       = o.id)    AS customers,
  coalesce((SELECT b.credit_balance FROM public.organization_sms_balances b
            WHERE b.organization_id = o.id), 0)                                        AS sms_credits
FROM public.organizations o;

REVOKE ALL ON public.admin_organization_overview FROM public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Usage
-- ---------------------------------------------------------------------------
-- 1. Look at what you have. Organizations with real orders or a credit
--    balance are probably not test data:
--
--      SELECT * FROM admin_organization_overview ORDER BY created_at DESC;
--
-- 2. Dry run. Returns the exact row counts a real run would delete:
--
--      SELECT jsonb_pretty(admin_purge_organizations(ARRAY[
--        '00000000-0000-0000-0000-000000000000'::uuid,
--        '11111111-1111-1111-1111-111111111111'::uuid
--      ]));
--
-- 3. Apply it, once the dry run looks right:
--
--      SELECT jsonb_pretty(admin_purge_organizations(ARRAY[
--        '00000000-0000-0000-0000-000000000000'::uuid,
--        '11111111-1111-1111-1111-111111111111'::uuid
--      ], false));
--
-- To select by name instead of pasting ids, build the array from a query --
-- but always eyeball the dry run first:
--
--      SELECT jsonb_pretty(admin_purge_organizations(
--        (SELECT array_agg(id) FROM organizations WHERE name ILIKE '%test%')
--      ));
