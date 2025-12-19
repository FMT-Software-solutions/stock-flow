-- Function to seed default expense categories and types
CREATE OR REPLACE FUNCTION public.seed_default_expense_categories(org_id uuid)
RETURNS void AS $$
DECLARE
    cat_utilities_id uuid;
    cat_rent_id uuid;
    cat_salaries_id uuid;
    cat_supplies_id uuid;
    cat_maintenance_id uuid;
    cat_marketing_id uuid;
    cat_travel_id uuid;
BEGIN
    -- 1. Utilities
    INSERT INTO public.expense_categories (organization_id, name, description)
    VALUES (org_id, 'Utilities', 'Monthly utility bills')
    RETURNING id INTO cat_utilities_id;

    INSERT INTO public.expense_types (organization_id, category_id, name) VALUES
    (org_id, cat_utilities_id, 'Electricity'),
    (org_id, cat_utilities_id, 'Water'),
    (org_id, cat_utilities_id, 'Internet'),
    (org_id, cat_utilities_id, 'Phone');

    -- 2. Rent
    INSERT INTO public.expense_categories (organization_id, name, description)
    VALUES (org_id, 'Rent', 'Office and warehouse rent')
    RETURNING id INTO cat_rent_id;

    INSERT INTO public.expense_types (organization_id, category_id, name) VALUES
    (org_id, cat_rent_id, 'Office Rent'),
    (org_id, cat_rent_id, 'Warehouse Rent');

    -- 3. Salaries
    INSERT INTO public.expense_categories (organization_id, name, description)
    VALUES (org_id, 'Salaries', 'Employee salaries and wages')
    RETURNING id INTO cat_salaries_id;

    INSERT INTO public.expense_types (organization_id, category_id, name) VALUES
    (org_id, cat_salaries_id, 'Full-time Staff'),
    (org_id, cat_salaries_id, 'Contractors'),
    (org_id, cat_salaries_id, 'Bonuses'),
    (org_id, cat_salaries_id, 'Commissions');

    -- 4. Office Supplies
    INSERT INTO public.expense_categories (organization_id, name, description)
    VALUES (org_id, 'Office Supplies', 'Consumable office items')
    RETURNING id INTO cat_supplies_id;

    INSERT INTO public.expense_types (organization_id, category_id, name) VALUES
    (org_id, cat_supplies_id, 'Stationery'),
    (org_id, cat_supplies_id, 'Kitchen Supplies'),
    (org_id, cat_supplies_id, 'Cleaning Supplies'),
    (org_id, cat_supplies_id, 'Printer Ink/Toner');

    -- 5. Maintenance
    INSERT INTO public.expense_categories (organization_id, name, description)
    VALUES (org_id, 'Maintenance', 'Repairs and maintenance')
    RETURNING id INTO cat_maintenance_id;

    INSERT INTO public.expense_types (organization_id, category_id, name) VALUES
    (org_id, cat_maintenance_id, 'Equipment Repair'),
    (org_id, cat_maintenance_id, 'Vehicle Maintenance'),
    (org_id, cat_maintenance_id, 'Building Maintenance');

    -- 6. Marketing
    INSERT INTO public.expense_categories (organization_id, name, description)
    VALUES (org_id, 'Marketing', 'Advertising and promotion')
    RETURNING id INTO cat_marketing_id;

    INSERT INTO public.expense_types (organization_id, category_id, name) VALUES
    (org_id, cat_marketing_id, 'Social Media Ads'),
    (org_id, cat_marketing_id, 'Print Media'),
    (org_id, cat_marketing_id, 'Events');

    -- 7. Travel
    INSERT INTO public.expense_categories (organization_id, name, description)
    VALUES (org_id, 'Travel', 'Business travel expenses')
    RETURNING id INTO cat_travel_id;

    INSERT INTO public.expense_types (organization_id, category_id, name) VALUES
    (org_id, cat_travel_id, 'Flights'),
    (org_id, cat_travel_id, 'Hotels'),
    (org_id, cat_travel_id, 'Meals'),
    (org_id, cat_travel_id, 'Transportation');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_organization_expenses()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.seed_default_expense_categories(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS on_org_created_seed_expenses ON public.organizations;
CREATE TRIGGER on_org_created_seed_expenses
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_organization_expenses();

-- Backfill for existing organizations
DO $$
DECLARE
    org_rec record;
BEGIN
    FOR org_rec IN SELECT id FROM public.organizations LOOP
        -- Check if categories already exist to avoid duplicates (optional, but safer)
        IF NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE organization_id = org_rec.id) THEN
            PERFORM public.seed_default_expense_categories(org_rec.id);
        END IF;
    END LOOP;
END $$;
