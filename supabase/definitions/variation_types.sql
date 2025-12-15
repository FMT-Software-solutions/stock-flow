create table public.variation_types (
  id uuid not null default gen_random_uuid (),
  name text not null,
  organization_id uuid null,
  is_default boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint variation_types_pkey primary key (id),
  constraint variation_types_org_name_key unique (organization_id, name)
) TABLESPACE pg_default;