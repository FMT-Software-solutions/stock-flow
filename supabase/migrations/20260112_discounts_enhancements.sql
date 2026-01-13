-- Ensure unique discount codes per organization (ignoring NULL codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_discounts_org_code_unique
ON public.discounts (organization_id, code)
WHERE code IS NOT NULL;

-- Add usage mode and limits
ALTER TABLE public.discounts
ADD COLUMN IF NOT EXISTS usage_mode TEXT CHECK (usage_mode IN ('automatic','manual')) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS usage_limit INTEGER CHECK (usage_limit >= 0),
ADD COLUMN IF NOT EXISTS times_used INTEGER DEFAULT 0;

