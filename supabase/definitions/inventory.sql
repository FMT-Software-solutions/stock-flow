create table public.inventory (
  id uuid not null default gen_random_uuid (),
  product_id uuid null,
  variant_id uuid null,
  branch_id uuid null,
  quantity numeric(12, 2) null default 0,
  min_stock_level numeric(12, 2) null default 0,
  location text null,
  organization_id uuid not null,
  last_updated timestamp with time zone null default now(),
  constraint inventory_pkey primary key (id),
  constraint inventory_branch_id_fkey foreign KEY (branch_id) references branches (id) on delete set null,
  constraint inventory_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint inventory_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint inventory_variant_id_fkey foreign KEY (variant_id) references product_variants (id) on delete CASCADE
) TABLESPACE pg_default;