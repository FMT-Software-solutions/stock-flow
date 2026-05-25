-- 1. Create a trigger function to catch manual updates to paid_amount
CREATE OR REPLACE FUNCTION public.sync_manual_payment_updates()
RETURNS TRIGGER AS $$
DECLARE
    v_ledger_total NUMERIC;
    v_difference NUMERIC;
BEGIN
    -- Only act if paid_amount actually changed
    IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
        
        -- Get the current total from the ledger
        SELECT COALESCE(SUM(amount), 0)
        INTO v_ledger_total
        FROM public.order_payments
        WHERE order_id = NEW.id;

        -- Calculate the difference between the new paid_amount and the ledger
        v_difference := NEW.paid_amount - v_ledger_total;

        -- If the new paid_amount is GREATER than the ledger (e.g. user manually typed a higher number)
        -- We insert the difference as a new payment record.
        IF v_difference > 0 THEN
            INSERT INTO public.order_payments (
                organization_id,
                order_id,
                amount,
                payment_method,
                notes,
                created_by
            ) VALUES (
                NEW.organization_id,
                NEW.id,
                v_difference,
                COALESCE(NEW.payment_method, 'cash'),
                'Auto-generated from manual balance update',
                NEW.updated_by -- Assuming updated_by is set, otherwise might be null depending on app logic
            );
        END IF;

        -- Note: If the difference is negative (they lowered the paid_amount), 
        -- we don't automatically delete payments because that's dangerous. 
        -- But for positive additions, this perfectly patches the "missing cash" hole.
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the orders table
DROP TRIGGER IF EXISTS trg_sync_manual_payment_updates ON public.orders;
CREATE TRIGGER trg_sync_manual_payment_updates
    AFTER UPDATE OF paid_amount ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_manual_payment_updates();


-- 3. ONE-TIME BACKFILL: Fix any existing orders where paid_amount > ledger total
DO $$
DECLARE
    r RECORD;
    v_difference NUMERIC;
BEGIN
    FOR r IN 
        SELECT 
            o.id,
            o.organization_id,
            o.payment_method,
            o.paid_amount,
            COALESCE(SUM(op.amount), 0) AS ledger_total
        FROM public.orders o
        LEFT JOIN public.order_payments op ON o.id = op.order_id
        WHERE o.is_deleted = false
        GROUP BY o.id, o.organization_id, o.payment_method, o.paid_amount
        HAVING o.paid_amount > COALESCE(SUM(op.amount), 0)
    LOOP
        v_difference := r.paid_amount - r.ledger_total;
        
        INSERT INTO public.order_payments (
            organization_id,
            order_id,
            amount,
            payment_method,
            notes
        ) VALUES (
            r.organization_id,
            r.id,
            v_difference,
            COALESCE(r.payment_method, 'cash'),
            'Auto-generated backfill for missing manual payment'
        );
    END LOOP;
END;
$$;