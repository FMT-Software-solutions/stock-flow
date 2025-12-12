-- Create organization_roles table
CREATE TABLE IF NOT EXISTS public.organization_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    type text NOT NULL DEFAULT 'custom', -- 'owner', 'admin', 'branch_admin', 'custom'
    permissions text NOT NULL, -- JSON string
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(organization_id, name)
);

-- Add role_id to user_organizations
ALTER TABLE public.user_organizations 
ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.organization_roles(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;


-- Function to seed roles for an organization
CREATE OR REPLACE FUNCTION public.seed_organization_roles(org_id uuid)
RETURNS void AS $$
DECLARE
    -- Default permissions based on ROLE_DEFAULT_PERMISSIONS in config.ts
    perm_owner text := '{"dashboard":{"enabled":true,"actions":[]},"user_management":{"enabled":true,"actions":["create","edit","activate_deactivate","delete","update_permissions"]},"branch_management":{"enabled":true,"actions":["create","edit","activate_deactivate"]},"settings":{"enabled":true,"actions":["manage_org_details","view_org_appearance_prefs","manage_org_appearance_prefs","manage_notifications"]}}';
    perm_admin text := '{"dashboard":{"enabled":true,"actions":[]},"user_management":{"enabled":true,"actions":["create","edit","activate_deactivate","delete","update_permissions"]},"branch_management":{"enabled":true,"actions":["create","edit","activate_deactivate"]},"settings":{"enabled":true,"actions":["manage_org_details","view_org_appearance_prefs","manage_org_appearance_prefs","manage_notifications"]}}';
    perm_branch_admin text := '{"dashboard":{"enabled":true,"actions":[]},"user_management":{"enabled":true,"actions":["create","edit","activate_deactivate"]},"branch_management":{"enabled":true,"actions":["edit"]},"settings":{"enabled":true,"actions":["view_org_appearance_prefs"]}}';
    perm_write text := '{"dashboard":{"enabled":true,"actions":[]}}';
    perm_read text := '{"dashboard":{"enabled":true,"actions":[]}}';
BEGIN
    INSERT INTO public.organization_roles (organization_id, name, type, permissions, description)
    VALUES
    (org_id, 'Owner', 'owner', perm_owner, 'Full access to all resources'),
    (org_id, 'Admin', 'admin', perm_admin, 'Administrator access'),
    (org_id, 'Branch Admin', 'branch_admin', perm_branch_admin, 'Branch management access'),
    (org_id, 'Editor', 'custom', perm_write, 'Standard editor access'),
    (org_id, 'Viewer', 'custom', perm_read, 'Read-only access')
    ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to seed roles on organization creation
CREATE OR REPLACE FUNCTION public.handle_new_organization_roles()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.seed_organization_roles(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_created_seed_roles ON public.organizations;
CREATE TRIGGER on_org_created_seed_roles
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_organization_roles();

-- Migration Block: Seed existing orgs and update user_organizations
DO $$
DECLARE
    org_rec record;
BEGIN
    -- 1. Seed roles for all existing organizations
    FOR org_rec IN SELECT id FROM public.organizations LOOP
        PERFORM public.seed_organization_roles(org_rec.id);
    END LOOP;

    -- 2. Update user_organizations role_id
    -- We map string roles to the newly created role IDs
    
    -- Owner
    UPDATE public.user_organizations uo
    SET role_id = (
        SELECT id FROM public.organization_roles 
        WHERE organization_id = uo.organization_id AND type = 'owner' LIMIT 1
    )
    WHERE role = 'owner' AND role_id IS NULL;

    -- Admin
    UPDATE public.user_organizations uo
    SET role_id = (
        SELECT id FROM public.organization_roles 
        WHERE organization_id = uo.organization_id AND type = 'admin' LIMIT 1
    )
    WHERE role = 'admin' AND role_id IS NULL;

    -- Branch Admin
    UPDATE public.user_organizations uo
    SET role_id = (
        SELECT id FROM public.organization_roles 
        WHERE organization_id = uo.organization_id AND type = 'branch_admin' LIMIT 1
    )
    WHERE role = 'branch_admin' AND role_id IS NULL;

    -- Write (Editor)
    UPDATE public.user_organizations uo
    SET role_id = (
        SELECT id FROM public.organization_roles 
        WHERE organization_id = uo.organization_id AND name = 'Editor' LIMIT 1
    )
    WHERE role = 'write' AND role_id IS NULL;

    -- Read (Viewer)
    UPDATE public.user_organizations uo
    SET role_id = (
        SELECT id FROM public.organization_roles 
        WHERE organization_id = uo.organization_id AND name = 'Viewer' LIMIT 1
    )
    WHERE role = 'read' AND role_id IS NULL;

END $$;
