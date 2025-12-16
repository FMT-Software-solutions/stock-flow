-- Add ai_daily_limit column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS ai_daily_limit INTEGER NOT NULL DEFAULT 20;

-- Function to set default ai_daily_limit (redundant with DEFAULT 20, but requested by user as a trigger)
-- Actually, the user asked for a trigger to set the default limit.
-- Since we have DEFAULT 20, the trigger is strictly not needed for new rows if the client omits the column.
-- But if the client explicitly sends NULL, the DEFAULT won't apply (unless we use trigger).
-- Or if they want to enforce a policy.
-- I'll add a trigger that ensures it's set to 20 if it's null, effectively reinforcing the default.

CREATE OR REPLACE FUNCTION public.set_default_ai_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ai_daily_limit IS NULL THEN
        NEW.ai_daily_limit := 20;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_default_ai_limit ON public.organizations;

CREATE TRIGGER trigger_set_default_ai_limit
BEFORE INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.set_default_ai_limit();
