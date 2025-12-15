-- Add quantity and min_stock_level columns to product_variants table
ALTER TABLE product_variants 
ADD COLUMN quantity NUMERIC(12,2) DEFAULT 0,
ADD COLUMN min_stock_level NUMERIC(12,2) DEFAULT 0;

-- Optional: specific policy updates if needed, but existing RLS should cover it since it's on the table
