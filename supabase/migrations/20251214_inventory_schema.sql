-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    website TEXT,
    organization_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES product_categories(id),
    image_url TEXT,
    organization_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Variation Types (e.g. Size, Color)
CREATE TABLE variation_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization_id UUID, -- Null for system defaults
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Variation Options (e.g. Small, Red)
CREATE TABLE variation_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variation_type_id UUID REFERENCES variation_types(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT,
    description TEXT,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    brand TEXT,
    cost_price NUMERIC(10,2),
    selling_price NUMERIC(10,2),
    unit TEXT,
    status TEXT DEFAULT 'draft', -- published, draft, inactive
    image_url TEXT,
    additional_images TEXT[],
    tax_rate NUMERIC(5,2),
    barcode TEXT,
    discount JSONB, -- { enabled: boolean, type: 'percentage'|'fixed', value: number }
    organization_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    has_variations BOOLEAN DEFAULT false
);

-- Product Variants (for products with variations)
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT,
    price NUMERIC(10,2),
    attributes JSONB, -- { "Color": "Red", "Size": "M" }
    organization_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory (Stock)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    branch_id UUID, -- Nullable if org-wide? Rule says "add branch_id".
    quantity NUMERIC(12,2) DEFAULT 0,
    min_stock_level NUMERIC(12,2) DEFAULT 0,
    location TEXT,
    organization_id UUID NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE variation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE variation_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Policies
-- Suppliers
CREATE POLICY "Users can access their organization's suppliers" ON suppliers
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- Categories
CREATE POLICY "Users can access their organization's categories" ON product_categories
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- Variation Types
CREATE POLICY "Users can access their organization's variation types and defaults" ON variation_types
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()) OR organization_id IS NULL);

-- Variation Options
CREATE POLICY "Users can access their organization's variation options and defaults" ON variation_options
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()) OR organization_id IS NULL);

-- Products
CREATE POLICY "Users can access their organization's products" ON products
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- Product Variants
CREATE POLICY "Users can access their organization's product variants" ON product_variants
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- Inventory
CREATE POLICY "Users can access their organization's inventory" ON inventory
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

-- View for Inventory
CREATE VIEW inventory_view AS
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
    pc.name as category_name,
    s.name as supplier_name,
    COALESCE(SUM(i.quantity), 0) as quantity,
    COALESCE(MIN(i.min_stock_level), 0) as min_stock_level,
    -- For location, if multiple locations (branches), this aggregation is arbitrary.
    -- But if filtered by branch (via RLS on inventory?), the view might still aggregate if multiple rows exist.
    -- We'll take the first location found.
    MAX(i.location) as location 
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN inventory i ON p.id = i.product_id
GROUP BY p.id, pc.name, s.name;
