-- Function to handle order soft delete and stock restoration
CREATE OR REPLACE FUNCTION public.handle_order_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    -- If order is being soft deleted
    IF NEW.is_deleted = TRUE AND OLD.is_deleted = FALSE THEN
        -- Only restock if the order wasn't already cancelled or refunded (which would have restocked it)
        IF OLD.status != 'cancelled' AND OLD.status != 'refunded' THEN
            FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
                IF item.inventory_id IS NOT NULL THEN
                    UPDATE public.inventory
                    SET quantity = quantity + item.quantity,
                        last_updated = now()
                    WHERE id = item.inventory_id;
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- If order is being restored
    IF NEW.is_deleted = FALSE AND OLD.is_deleted = TRUE THEN
        -- Only deduct stock if the order isn't cancelled or refunded
        IF NEW.status != 'cancelled' AND NEW.status != 'refunded' THEN
            FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
                IF item.inventory_id IS NOT NULL THEN
                    UPDATE public.inventory
                    SET quantity = quantity - item.quantity,
                        last_updated = now()
                    WHERE id = item.inventory_id;
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for UPDATE on is_deleted
DROP TRIGGER IF EXISTS trigger_handle_order_soft_delete ON public.orders;
CREATE TRIGGER trigger_handle_order_soft_delete
AFTER UPDATE OF is_deleted ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_soft_delete();
