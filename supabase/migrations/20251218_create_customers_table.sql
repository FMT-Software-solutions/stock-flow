-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    CONSTRAINT customers_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy
CREATE POLICY "Users can access their organization's customers" ON public.customers
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- Add audit triggers
CREATE TRIGGER set_audit_fields_customers
    BEFORE INSERT OR UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_audit_fields();
