-- Add abbreviation to organizations and branches
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS abbreviation TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS abbreviation TEXT;

-- Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, cancelled, refunded
    payment_status TEXT NOT NULL DEFAULT 'unpaid', -- paid, unpaid, partial, refunded
    payment_method TEXT, -- cash, card, mobile_money, bank_transfer, other
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT orders_organization_id_order_number_key UNIQUE (organization_id, order_number)
);

-- Create Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL, -- Snapshot
    sku TEXT, -- Snapshot
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0, -- Snapshot
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their organization's orders" ON public.orders
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users can access their organization's order items" ON public.order_items
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- Function to generate order number
-- Format: {OrgAbbr}-{BranchAbbr}-{Seq}
-- If Abbrs are null, use default 'ORG' and 'BR'
-- We need a sequence. Instead of a global sequence, we can use a table to track sequences per branch.

CREATE TABLE IF NOT EXISTS public.order_sequences (
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    last_value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (organization_id, branch_id)
);

ALTER TABLE public.order_sequences ENABLE ROW LEVEL SECURITY;

-- Order Number Generator Function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    org_abbr TEXT;
    branch_abbr TEXT;
    seq_val INTEGER;
    new_order_number TEXT;
BEGIN
    -- Only generate if not provided
    IF NEW.order_number IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get Organization Abbreviation
    SELECT COALESCE(abbreviation, SUBSTRING(name, 1, 3)) INTO org_abbr
    FROM public.organizations WHERE id = NEW.organization_id;
    
    IF org_abbr IS NULL THEN org_abbr := 'ORG'; END IF;

    -- Get Branch Abbreviation
    IF NEW.branch_id IS NOT NULL THEN
        SELECT COALESCE(abbreviation, SUBSTRING(name, 1, 3)) INTO branch_abbr
        FROM public.branches WHERE id = NEW.branch_id;
    END IF;
    
    IF branch_abbr IS NULL THEN branch_abbr := 'BR'; END IF;

    -- Get Next Sequence Value
    INSERT INTO public.order_sequences (organization_id, branch_id, last_value)
    VALUES (NEW.organization_id, NEW.branch_id, 1)
    ON CONFLICT (organization_id, branch_id)
    DO UPDATE SET last_value = public.order_sequences.last_value + 1
    RETURNING last_value INTO seq_val;

    -- Format Order Number
    new_order_number := UPPER(org_abbr) || '-' || UPPER(branch_abbr) || '-' || LPAD(seq_val::TEXT, 6, '0');
    
    NEW.order_number := new_order_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

-- Add audit fields trigger (assuming set_audit_fields function exists from previous migrations)
CREATE TRIGGER set_audit_fields_orders
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_fields();
