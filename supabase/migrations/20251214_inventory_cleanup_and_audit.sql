ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_branch_id_fkey;

ALTER TABLE public.products
DROP COLUMN IF EXISTS branch_id;

ALTER TABLE public.product_variants
DROP COLUMN IF EXISTS quantity,
DROP COLUMN IF EXISTS min_stock_level;

ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.product_categories
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.variation_types
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.variation_options
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE ONLY public.suppliers
ADD CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT suppliers_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT suppliers_created_by_fkey2 FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT suppliers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT suppliers_updated_by_fkey1 FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT suppliers_updated_by_fkey2 FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.product_categories
ADD CONSTRAINT product_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT product_categories_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT product_categories_created_by_fkey2 FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT product_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT product_categories_updated_by_fkey1 FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT product_categories_updated_by_fkey2 FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.variation_types
ADD CONSTRAINT variation_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_types_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_types_created_by_fkey2 FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_types_updated_by_fkey1 FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_types_updated_by_fkey2 FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.variation_options
ADD CONSTRAINT variation_options_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_options_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_options_created_by_fkey2 FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_options_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_options_updated_by_fkey1 FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT variation_options_updated_by_fkey2 FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.products
ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT products_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT products_created_by_fkey2 FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT products_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT products_updated_by_fkey1 FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT products_updated_by_fkey2 FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.product_variants
ADD CONSTRAINT product_variants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT product_variants_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT product_variants_created_by_fkey2 FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT product_variants_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT product_variants_updated_by_fkey1 FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT product_variants_updated_by_fkey2 FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.inventory
ADD CONSTRAINT inventory_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT inventory_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT inventory_created_by_fkey2 FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT inventory_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
ADD CONSTRAINT inventory_updated_by_fkey1 FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
ADD CONSTRAINT inventory_updated_by_fkey2 FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_audit_fields_suppliers
BEFORE INSERT OR UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_fields();

CREATE TRIGGER set_audit_fields_product_categories
BEFORE INSERT OR UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_fields();

CREATE TRIGGER set_audit_fields_variation_types
BEFORE INSERT OR UPDATE ON public.variation_types
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_fields();

CREATE TRIGGER set_audit_fields_variation_options
BEFORE INSERT OR UPDATE ON public.variation_options
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_fields();

CREATE TRIGGER set_audit_fields_products
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_fields();

CREATE TRIGGER set_audit_fields_product_variants
BEFORE INSERT OR UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_fields();

CREATE TRIGGER set_audit_fields_inventory
BEFORE INSERT OR UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_fields();

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
  pc.name AS category_name,
  s.name AS supplier_name
FROM
  public.products p
  LEFT JOIN public.product_categories pc ON p.category_id = pc.id
  LEFT JOIN public.suppliers s ON p.supplier_id = s.id;


