create table public.product_categories (
  id uuid not null default gen_random_uuid (),
  name text not null,
  slug text not null,
  description text null,
  parent_id uuid null,
  image_url text null,
  organization_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint product_categories_pkey primary key (id),
  constraint product_categories_parent_id_fkey foreign KEY (parent_id) references product_categories (id)
) TABLESPACE pg_default;