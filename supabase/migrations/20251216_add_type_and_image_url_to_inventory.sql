-- Add type and image_url columns to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'variant'; -- 'variant' or 'custom'
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS image_url TEXT;
