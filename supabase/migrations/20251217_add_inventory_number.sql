-- Add inventory_number column to inventory table
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS inventory_number TEXT;

-- Add unique constraint (scoped to organization)
-- We use a unique index instead of a constraint to allow NULLs if needed (though we aim to fill them)
-- But here we want strict uniqueness for non-null values.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_number_org_unique 
ON public.inventory (organization_id, inventory_number);

-- Function to generate unique inventory number
CREATE OR REPLACE FUNCTION public.generate_inventory_number()
RETURNS TRIGGER AS $$
DECLARE
  new_number TEXT;
  exists BOOLEAN;
  attempts INTEGER := 0;
  min_val INTEGER := 1000;
  max_val INTEGER := 999999;
BEGIN
  -- Only generate if not provided
  IF NEW.inventory_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  LOOP
    -- Generate random number between 1000 and 999999
    new_number := floor(random() * (max_val - min_val + 1) + min_val)::text;
    
    -- Check uniqueness for this organization
    SELECT EXISTS (
      SELECT 1 FROM public.inventory 
      WHERE organization_id = NEW.organization_id 
      AND inventory_number = new_number
    ) INTO exists;

    IF NOT exists THEN
      NEW.inventory_number := new_number;
      EXIT;
    END IF;

    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique inventory number after 100 attempts';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_inventory_number_trigger ON public.inventory;

CREATE TRIGGER set_inventory_number_trigger
BEFORE INSERT OR UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.generate_inventory_number();

-- Backfill existing records
-- We trigger the update by setting the ID to itself for rows with null inventory_number
UPDATE public.inventory 
SET id = id 
WHERE inventory_number IS NULL;
