-- Function to update inventory quantity when an order item is created
CREATE OR REPLACE FUNCTION public.update_inventory_on_order_item_create()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrease inventory quantity
    -- We prefer using inventory_id if available
    IF NEW.inventory_id IS NOT NULL THEN
        UPDATE public.inventory
        SET quantity = quantity - NEW.quantity,
            last_updated = now()
        WHERE id = NEW.inventory_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for INSERT
DROP TRIGGER IF EXISTS trigger_update_inventory_on_order_item_create ON public.order_items;
CREATE TRIGGER trigger_update_inventory_on_order_item_create
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.update_inventory_on_order_item_create();


-- Function to restore inventory when an order item is deleted (e.g. during edit/replace)
CREATE OR REPLACE FUNCTION public.restore_inventory_on_order_item_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Increase inventory quantity (Restock)
    IF OLD.inventory_id IS NOT NULL THEN
        UPDATE public.inventory
        SET quantity = quantity + OLD.quantity,
            last_updated = now()
        WHERE id = OLD.inventory_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for DELETE
DROP TRIGGER IF EXISTS trigger_restore_inventory_on_order_item_delete ON public.order_items;
CREATE TRIGGER trigger_restore_inventory_on_order_item_delete
AFTER DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.restore_inventory_on_order_item_delete();


-- Function to handle order status changes (Cancelled/Refunded)
-- Note: This might overlap if we also delete items, but usually status change is a soft delete.
-- If items are deleted, the DELETE trigger fires. If status changes, this fires.
-- We must ensure we don't double count if the app does both (it shouldn't).
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    -- If status changed to 'cancelled' or 'refunded' from something else, restock
    IF (NEW.status = 'cancelled' OR NEW.status = 'refunded') AND (OLD.status != 'cancelled' AND OLD.status != 'refunded') THEN
        FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
            IF item.inventory_id IS NOT NULL THEN
                UPDATE public.inventory
                SET quantity = quantity + item.quantity,
                    last_updated = now()
                WHERE id = item.inventory_id;
            END IF;
        END LOOP;
    END IF;
    
    -- If status changed from 'cancelled'/'refunded' to 'pending'/'processing'/'completed', deduct again
    IF (OLD.status = 'cancelled' OR OLD.status = 'refunded') AND (NEW.status != 'cancelled' AND NEW.status != 'refunded') THEN
        FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
            IF item.inventory_id IS NOT NULL THEN
                UPDATE public.inventory
                SET quantity = quantity - item.quantity,
                    last_updated = now()
                WHERE id = item.inventory_id;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_order_status_change ON public.orders;
CREATE TRIGGER trigger_handle_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_status_change();
