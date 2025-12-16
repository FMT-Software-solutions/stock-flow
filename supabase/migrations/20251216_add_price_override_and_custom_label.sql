-- Add price_override and custom_label columns to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS price_override NUMERIC(10,2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS custom_label TEXT;
