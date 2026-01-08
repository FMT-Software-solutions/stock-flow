CREATE OR REPLACE FUNCTION public.get_user_org_context(user_id uuid)
RETURNS TABLE (
  organization jsonb,
  user_role text,
  role_id uuid,
  role_name text,
  base_role_permissions jsonb,
  user_overrides jsonb,
  branch_ids uuid[],
  effective_permissions jsonb,
  needs_seeding boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT
  to_jsonb(org.*) AS organization,
  uo.role AS user_role,
  COALESCE(
    uo.role_id,
    (
      SELECT orl.id
      FROM public.organization_roles orl
      WHERE orl.organization_id = uo.organization_id AND orl.type = uo.role
      LIMIT 1
    )
  ) AS role_id,
  COALESCE(
    (SELECT orl.name FROM public.organization_roles orl WHERE orl.id = uo.role_id),
    (SELECT orl2.name FROM public.organization_roles orl2 WHERE orl2.organization_id = uo.organization_id AND orl2.type = uo.role LIMIT 1)
  ) AS role_name,
  COALESCE(
    (SELECT orl.permissions::jsonb FROM public.organization_roles orl WHERE orl.id = uo.role_id),
    (SELECT orl2.permissions::jsonb FROM public.organization_roles orl2 WHERE orl2.organization_id = uo.organization_id AND orl2.type = uo.role LIMIT 1),
    '{}'::jsonb
  ) AS base_role_permissions,
  CASE WHEN uo.permissions IS NULL OR trim(uo.permissions) = '' THEN NULL ELSE uo.permissions::jsonb END AS user_overrides,
  COALESCE((
    SELECT array_agg(ub.branch_id)
    FROM public.user_branches ub
    WHERE ub.user_id = uo.user_id AND ub.organization_id = uo.organization_id
  ), ARRAY[]::uuid[]) AS branch_ids,
  NULL::jsonb AS effective_permissions,
  (
    COALESCE(
      (SELECT 1 FROM public.organization_roles orl WHERE orl.id = uo.role_id),
      (SELECT 1 FROM public.organization_roles orl2 WHERE orl2.organization_id = uo.organization_id AND orl2.type = uo.role LIMIT 1)
    ) IS NULL
  ) AS needs_seeding
FROM public.user_organizations uo
JOIN public.organizations org ON org.id = uo.organization_id AND org.is_active = TRUE
WHERE uo.user_id = get_user_org_context.user_id
ORDER BY uo.created_at ASC;
$$;
