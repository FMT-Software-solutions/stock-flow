-- Add paid_amount to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Trigger to auto-update paid_amount on status change if needed?
-- User logic:
-- paid -> paid_amount = total_amount
-- unpaid/refunded -> paid_amount = 0
-- partial -> manual amount
-- This logic will be handled in the application layer (frontend/backend APIs) mostly, 
-- but we can add constraints or triggers if we want strict data integrity. 
-- For now, app-level logic is requested.
