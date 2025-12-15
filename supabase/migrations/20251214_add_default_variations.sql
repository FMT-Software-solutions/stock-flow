-- Add unique constraints to prevent duplicates
ALTER TABLE public.variation_types 
ADD CONSTRAINT variation_types_org_name_key UNIQUE (organization_id, name);

ALTER TABLE public.variation_options 
ADD CONSTRAINT variation_options_type_value_key UNIQUE (variation_type_id, value);

-- Function to seed default variations for an organization
CREATE OR REPLACE FUNCTION public.seed_organization_variations(org_id uuid)
RETURNS void AS $$
DECLARE
    color_type_id uuid;
    size_type_id uuid;
BEGIN
    -- 1. Create 'Color' variation type
    INSERT INTO public.variation_types (organization_id, name, is_default)
    VALUES (org_id, 'Color', true)
    ON CONFLICT (organization_id, name) DO UPDATE SET is_default = true -- Ensure it's marked default if exists
    RETURNING id INTO color_type_id;

    -- If we didn't insert (because of conflict and no returning on update sometimes depending on PG version/logic, though RETURNING works with DO UPDATE), 
    -- let's ensure we have the ID.
    IF color_type_id IS NULL THEN
        SELECT id INTO color_type_id FROM public.variation_types WHERE organization_id = org_id AND name = 'Color';
    END IF;

    -- 2. Create default options for Color if we have the type
    IF color_type_id IS NOT NULL THEN
        INSERT INTO public.variation_options (variation_type_id, value, organization_id)
        VALUES 
            (color_type_id, 'Red', org_id),
            (color_type_id, 'Blue', org_id),
            (color_type_id, 'Green', org_id),
            (color_type_id, 'Black', org_id),
            (color_type_id, 'White', org_id)
        ON CONFLICT (variation_type_id, value) DO NOTHING;
    END IF;

    -- 3. Create 'Size' variation type
    INSERT INTO public.variation_types (organization_id, name, is_default)
    VALUES (org_id, 'Size', true)
    ON CONFLICT (organization_id, name) DO UPDATE SET is_default = true
    RETURNING id INTO size_type_id;

    IF size_type_id IS NULL THEN
        SELECT id INTO size_type_id FROM public.variation_types WHERE organization_id = org_id AND name = 'Size';
    END IF;

    -- 4. Create default options for Size
    IF size_type_id IS NOT NULL THEN
        INSERT INTO public.variation_options (variation_type_id, value, organization_id)
        VALUES 
            (size_type_id, 'XS', org_id),
            (size_type_id, 'S', org_id),
            (size_type_id, 'M', org_id),
            (size_type_id, 'L', org_id),
            (size_type_id, 'XL', org_id),
            (size_type_id, 'XXL', org_id)
        ON CONFLICT (variation_type_id, value) DO NOTHING;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to seed variations on organization creation
CREATE OR REPLACE FUNCTION public.handle_new_organization_variations()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.seed_organization_variations(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_created_seed_variations ON public.organizations;
CREATE TRIGGER on_org_created_seed_variations
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_organization_variations();

-- Migration Block: Seed existing orgs
DO $$
DECLARE
    org_rec record;
BEGIN
    FOR org_rec IN SELECT id FROM public.organizations LOOP
        PERFORM public.seed_organization_variations(org_rec.id);
    END LOOP;
END $$;
