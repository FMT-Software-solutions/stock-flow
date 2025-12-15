create table public.suppliers (
  id uuid not null default gen_random_uuid (),
  name text not null,
  contact_person text null,
  email text null,
  phone text null,
  address text null,
  website text null,
  organization_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint suppliers_pkey primary key (id),
  constraint suppliers_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;