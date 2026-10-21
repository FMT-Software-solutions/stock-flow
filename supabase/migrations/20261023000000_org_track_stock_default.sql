-- Whether new products track stock unless the user switches it off.
-- On for every existing organization (shops); restaurants and service
-- businesses can turn it off in Settings. get_user_org_context returns
-- to_jsonb(org.*), so the app sees the column without further changes.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS track_stock_by_default BOOLEAN NOT NULL DEFAULT TRUE;
