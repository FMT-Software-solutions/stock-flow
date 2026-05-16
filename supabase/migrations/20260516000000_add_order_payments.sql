-- Migration: Add Order Payments
CREATE TABLE IF NOT EXISTS public.order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their organization's order payments" ON public.order_payments
    USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.add_order_payment(
    p_order_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_notes TEXT,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_organization_id UUID;
    v_total_amount NUMERIC;
    v_current_paid NUMERIC;
    v_new_paid NUMERIC;
    v_new_status TEXT;
    v_payment_id UUID;
BEGIN
    -- Get order details
    SELECT organization_id, total_amount, paid_amount 
    INTO v_organization_id, v_total_amount, v_current_paid
    FROM public.orders 
    WHERE id = p_order_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Insert payment record
    INSERT INTO public.order_payments (organization_id, order_id, amount, payment_method, notes, created_by)
    VALUES (v_organization_id, p_order_id, p_amount, p_payment_method, p_notes, p_user_id)
    RETURNING id INTO v_payment_id;

    -- Calculate new paid amount and status
    v_new_paid := v_current_paid + p_amount;
    
    IF v_new_paid >= v_total_amount THEN
        v_new_status := 'paid';
    ELSIF v_new_paid > 0 THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := 'unpaid';
    END IF;

    -- Update order
    UPDATE public.orders
    SET paid_amount = v_new_paid,
        payment_status = v_new_status,
        updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true, 
        'payment_id', v_payment_id, 
        'new_paid_amount', v_new_paid, 
        'new_status', v_new_status
    );
END;
$$;
