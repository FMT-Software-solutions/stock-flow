-- 1. Add columns to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS has_purchased BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ DEFAULT (now() + interval '30 days');

-- 2. Migrate data 
UPDATE public.organizations
SET trial_end_date = (created_at + interval '30 days')
WHERE trial_end_date IS NULL;

-- 3. Create Trigger Function for Organization Trial Logic (Auto-updates dates)
CREATE OR REPLACE FUNCTION public.handle_org_trial_logic()
RETURNS TRIGGER AS $$
BEGIN
    -- If purchased, clear trial date
    IF NEW.has_purchased = true THEN
        NEW.trial_end_date := NULL;
    END IF;

    -- If not purchased and trial date is null, set default 30 days
    IF NEW.has_purchased = false AND NEW.trial_end_date IS NULL THEN
        NEW.trial_end_date := COALESCE(NEW.created_at, now()) + interval '30 days';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach Trigger to Organizations
DROP TRIGGER IF EXISTS trigger_handle_org_trial_logic ON public.organizations;
CREATE TRIGGER trigger_handle_org_trial_logic
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.handle_org_trial_logic();

-- 5. Cleanup auth_users (Remove old fields)
-- We remove the columns to clean up schema
ALTER TABLE public.auth_users
DROP COLUMN IF EXISTS has_purchased,
DROP COLUMN IF EXISTS trial_end_date;

-- Drop the old trigger/function
DROP TRIGGER IF EXISTS trigger_handle_trial_logic ON public.auth_users;
DROP FUNCTION IF EXISTS public.handle_trial_logic();
