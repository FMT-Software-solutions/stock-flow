-- Update products_view to include description
DROP VIEW IF EXISTS public.products_view;

CREATE OR REPLACE VIEW public.products_view AS
SELECT
    p.id,
    p.name,
    p.sku,
    p.category_id,
    p.supplier_id,
    p.brand,
    p.cost_price,
    p.selling_price,
    p.unit,
    p.status,
    p.image_url,
    p.additional_images,
    p.tax_rate,
    p.barcode,
    p.discount,
    p.organization_id,
    p.created_at,
    p.updated_at,
    p.has_variations,
    p.description,
    pc.name as category_name,
    s.name as supplier_name,
    pr.first_name || ' ' || pr.last_name as created_by_name,
    COALESCE(SUM(i.quantity), 0) as quantity,
    COALESCE(MIN(i.min_stock_level), 0) as min_stock_level,
    MAX(i.location) as location
FROM
    products p
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN profiles pr ON p.created_by = pr.id
GROUP BY
    p.id,
    p.description,
    pc.name,
    s.name,
    pr.first_name,
    pr.last_name;

GRANT SELECT ON public.products_view TO authenticated;
GRANT SELECT ON public.products_view TO service_role;

-- AI Usage Tracking (Daily Counters)
CREATE TABLE IF NOT EXISTS public.organization_ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, usage_date)
);

ALTER TABLE public.organization_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's ai usage" ON public.organization_ai_usage
    FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- AI Request Logs (Detailed Audit Trail)
CREATE TABLE IF NOT EXISTS public.ai_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL, -- e.g., 'product_description'
    input_context JSONB, -- The data sent to AI
    generated_content TEXT,
    model_used TEXT,
    provider TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's ai logs" ON public.ai_request_logs
    FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

