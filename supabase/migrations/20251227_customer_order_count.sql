ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_orders INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_customer_order_count_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'completed' AND COALESCE(NEW.is_deleted, false) = false THEN
    UPDATE public.customers
    SET total_orders = COALESCE(total_orders, 0) + 1
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_customer_order_count_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(OLD.customer_id, '00000000-0000-0000-0000-000000000000') IS DISTINCT FROM COALESCE(NEW.customer_id, '00000000-0000-0000-0000-000000000000') THEN
    IF OLD.customer_id IS NOT NULL AND OLD.status = 'completed' AND COALESCE(OLD.is_deleted, false) = false THEN
      UPDATE public.customers
      SET total_orders = GREATEST(COALESCE(total_orders, 0) - 1, 0)
      WHERE id = OLD.customer_id;
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' AND COALESCE(NEW.is_deleted, false) = false THEN
      UPDATE public.customers
      SET total_orders = COALESCE(total_orders, 0) + 1
      WHERE id = NEW.customer_id;
    END IF;
  ELSE
    IF (OLD.status != 'completed' OR COALESCE(OLD.is_deleted, false) = true)
       AND NEW.status = 'completed' AND COALESCE(NEW.is_deleted, false) = false AND NEW.customer_id IS NOT NULL THEN
      UPDATE public.customers
      SET total_orders = COALESCE(total_orders, 0) + 1
      WHERE id = NEW.customer_id;
    END IF;
    IF OLD.status = 'completed' AND COALESCE(OLD.is_deleted, false) = false AND NEW.customer_id IS NOT NULL AND
       (NEW.status != 'completed' OR COALESCE(NEW.is_deleted, false) = true) THEN
      UPDATE public.customers
      SET total_orders = GREATEST(COALESCE(total_orders, 0) - 1, 0)
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_order_count_insert ON public.orders;
CREATE TRIGGER trg_customer_order_count_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_order_count_on_insert();

DROP TRIGGER IF EXISTS trg_customer_order_count_update ON public.orders;
CREATE TRIGGER trg_customer_order_count_update
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_order_count_on_update();

UPDATE public.customers c
SET total_orders = sub.cnt
FROM (
  SELECT customer_id, COUNT(*) AS cnt
  FROM public.orders
  WHERE customer_id IS NOT NULL AND status = 'completed' AND COALESCE(is_deleted, false) = false
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id;
