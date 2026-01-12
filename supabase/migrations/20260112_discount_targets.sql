ALTER TABLE public.discounts
ADD COLUMN IF NOT EXISTS target_mode TEXT CHECK (target_mode IN ('all','category','product','inventory'));

