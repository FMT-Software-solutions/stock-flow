create table public.product_variants (
  id uuid not null default gen_random_uuid (),
  product_id uuid null,
  sku text null,
  price numeric(10, 2) null,
  attributes jsonb null,
  organization_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  quantity numeric(12, 2) null default 0,
  min_stock_level numeric(12, 2) null default 0,
  constraint product_variants_pkey primary key (id),
  constraint product_variants_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE
) TABLESPACE pg_default;
