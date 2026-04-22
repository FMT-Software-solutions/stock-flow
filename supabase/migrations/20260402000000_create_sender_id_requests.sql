-- Create enum for sender ID status if not exists
DO $$ BEGIN
    CREATE TYPE sender_id_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create table for tracking sender ID requests
CREATE TABLE IF NOT EXISTS public.sender_id_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sender_id VARCHAR(11) NOT NULL,
    reason TEXT NOT NULL,
    status sender_id_status DEFAULT 'pending' NOT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(organization_id, sender_id)
);

-- Trigger function to enforce max 3 sender IDs per organization
CREATE OR REPLACE FUNCTION check_max_sender_ids()
RETURNS TRIGGER AS $$
DECLARE
    org_count INT;
BEGIN
    SELECT COUNT(*) INTO org_count FROM public.sender_id_requests WHERE organization_id = NEW.organization_id;
    IF org_count >= 3 THEN
        RAISE EXCEPTION 'Maximum of 3 sender IDs allowed per organization';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_sender_ids ON public.sender_id_requests;
CREATE TRIGGER enforce_max_sender_ids
BEFORE INSERT ON public.sender_id_requests
FOR EACH ROW EXECUTE FUNCTION check_max_sender_ids();

-- Trigger function to auto-set sms_sender_id on approval if it's currently empty,
-- and auto-clear it if an active sender ID is rejected
CREATE OR REPLACE FUNCTION handle_sender_id_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_org_sender_id VARCHAR(11);
    next_sender_id VARCHAR(11);
BEGIN
    SELECT sms_sender_id INTO current_org_sender_id FROM public.organizations WHERE id = NEW.organization_id;

    -- Scenario 1: Request becomes Approved
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        IF current_org_sender_id IS NULL OR current_org_sender_id = '' THEN
            UPDATE public.organizations
            SET sms_sender_id = NEW.sender_id
            WHERE id = NEW.organization_id;
        END IF;
    END IF;

    -- Scenario 2: Request was Approved, but is now Rejected
    IF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
        -- If the organization was actively using this newly rejected sender ID
        IF current_org_sender_id = NEW.sender_id THEN
            -- Find the next available approved sender ID
            SELECT sender_id INTO next_sender_id 
            FROM public.sender_id_requests 
            WHERE organization_id = NEW.organization_id AND status = 'approved' AND id != NEW.id
            ORDER BY created_at ASC
            LIMIT 1;

            -- Update the organization to use the next one (or null if none exist)
            UPDATE public.organizations
            SET sms_sender_id = next_sender_id
            WHERE id = NEW.organization_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_sender_id_status_change ON public.sender_id_requests;
CREATE TRIGGER on_sender_id_status_change
AFTER UPDATE ON public.sender_id_requests
FOR EACH ROW EXECUTE FUNCTION handle_sender_id_status_change();

-- Trigger function to handle deletion of active sender id
CREATE OR REPLACE FUNCTION handle_sender_id_deletion()
RETURNS TRIGGER AS $$
DECLARE
    next_sender_id VARCHAR(11);
    current_org_sender_id VARCHAR(11);
BEGIN
    SELECT sms_sender_id INTO current_org_sender_id FROM public.organizations WHERE id = OLD.organization_id;
    
    IF current_org_sender_id = OLD.sender_id THEN
        -- Find the next approved sender ID to replace it
        SELECT sender_id INTO next_sender_id 
        FROM public.sender_id_requests 
        WHERE organization_id = OLD.organization_id AND status = 'approved' AND id != OLD.id
        ORDER BY created_at ASC
        LIMIT 1;

        -- If next_sender_id is null, it naturally resets the org's sender id to null
        UPDATE public.organizations
        SET sms_sender_id = next_sender_id
        WHERE id = OLD.organization_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_sender_id_deleted ON public.sender_id_requests;
CREATE TRIGGER on_sender_id_deleted
AFTER DELETE ON public.sender_id_requests
FOR EACH ROW EXECUTE FUNCTION handle_sender_id_deletion();

-- Enable RLS
ALTER TABLE public.sender_id_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their organization's sender id requests"
ON public.sender_id_requests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_organizations uo 
        WHERE uo.organization_id = sender_id_requests.organization_id 
        AND uo.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert sender id requests for their organization"
ON public.sender_id_requests FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_organizations uo 
        WHERE uo.organization_id = sender_id_requests.organization_id 
        AND uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Users can delete sender id requests for their organization"
ON public.sender_id_requests FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM user_organizations uo 
        WHERE uo.organization_id = sender_id_requests.organization_id 
        AND uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Users can update sender id requests for their organization"
ON public.sender_id_requests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM user_organizations uo 
        WHERE uo.organization_id = sender_id_requests.organization_id 
        AND uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'admin')
    )
);

