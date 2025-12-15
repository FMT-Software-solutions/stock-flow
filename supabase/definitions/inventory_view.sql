create view public.inventory_view as
select
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
  COALESCE(sum(i.quantity), 0::numeric) as quantity,
  COALESCE(min(i.min_stock_level), 0::numeric) as min_stock_level,
  max(i.location) as location
from
  products p
  left join product_categories pc on p.category_id = pc.id
  left join suppliers s on p.supplier_id = s.id
  left join inventory i on p.id = i.product_id
group by
  p.id,
  pc.name,
  s.name;