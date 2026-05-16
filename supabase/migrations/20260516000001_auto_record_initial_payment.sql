-- Migration: Auto-record initial payment on order creation
-- This trigger automatically inserts the initial payment amount into the order_payments table
-- whenever a new order is created with a paid_amount > 0.

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.auto_record_initial_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only record if there is an actual payment amount greater than 0
    IF NEW.paid_amount > 0 THEN
        INSERT INTO public.order_payments (
            order_id,
            organization_id,
            amount,
            payment_method,
            notes,
            created_by
        ) VALUES (
            NEW.id,
            NEW.organization_id,
            NEW.paid_amount,
            NEW.payment_method,
            'Initial payment at checkout',
            NEW.created_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the orders table
DROP TRIGGER IF EXISTS trg_auto_record_initial_payment ON public.orders;
CREATE TRIGGER trg_auto_record_initial_payment
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_record_initial_payment();
