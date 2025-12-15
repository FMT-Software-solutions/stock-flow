create table public.variation_options (
  id uuid not null default gen_random_uuid (),
  variation_type_id uuid null,
  value text not null,
  organization_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint variation_options_pkey primary key (id),
  constraint variation_options_type_value_key unique (variation_type_id, value),
  constraint variation_options_variation_type_id_fkey foreign KEY (variation_type_id) references variation_types (id) on delete CASCADE
) TABLESPACE pg_default;