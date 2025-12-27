-- Add is_deleted column to orders table for soft delete
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
