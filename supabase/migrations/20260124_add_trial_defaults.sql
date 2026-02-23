-- Set default value for trial_end_date
ALTER TABLE public.auth_users 
ALTER COLUMN trial_end_date SET DEFAULT (now() + interval '30 days');

-- Update existing users who have null trial_end_date
UPDATE public.auth_users 
SET trial_end_date = (created_at + interval '30 days')
WHERE trial_end_date IS NULL;

-- Ensure trial is removed if has_purchased is true (data cleanup)
UPDATE public.auth_users
SET trial_end_date = NULL
WHERE has_purchased = true;

-- Create a function to handle trial logic on insert/update
CREATE OR REPLACE FUNCTION public.handle_trial_logic()
RETURNS TRIGGER AS $$
BEGIN
    -- If purchased, clear trial date
    IF NEW.has_purchased = true THEN
        NEW.trial_end_date := NULL;
    END IF;

    -- If not purchased and trial date is null (and it's a new user or explicitly set to null), set default 30 days
    -- Note: DEFAULT clause handles INSERTs where column is omitted. This handles explicit NULLs or updates.
    IF NEW.has_purchased = false AND NEW.trial_end_date IS NULL THEN
        -- Use created_at if available, else now
        NEW.trial_end_date := COALESCE(NEW.created_at, now()) + interval '30 days';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auth_users
DROP TRIGGER IF EXISTS trigger_handle_trial_logic ON public.auth_users;
CREATE TRIGGER trigger_handle_trial_logic
BEFORE INSERT OR UPDATE ON public.auth_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_trial_logic();