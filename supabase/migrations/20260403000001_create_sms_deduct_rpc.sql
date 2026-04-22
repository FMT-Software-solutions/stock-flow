-- Safe SMS credit deduction RPC to avoid race conditions
CREATE OR REPLACE FUNCTION public.deduct_sms_credits(
  p_org_id uuid,
  p_message_count integer,
  p_recipient text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_current_bonus integer;
  v_new_balance integer;
  v_bonus_amount integer := 0;
  v_usage_amount integer;
  v_result jsonb;
BEGIN
  -- 1. Lock the row for update to prevent race conditions
  SELECT credit_balance, bonus_credits_received
  INTO v_current_balance, v_current_bonus
  FROM public.organization_sms_balances
  WHERE organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization SMS balance not found';
  END IF;

  -- 2. Calculate new balance and potential bonus overdraft
  v_new_balance := v_current_balance - p_message_count;

  IF v_new_balance < 0 THEN
    v_bonus_amount := ABS(v_new_balance);
    v_new_balance := 0; -- Prevent negative balances
  END IF;

  v_usage_amount := p_message_count - v_bonus_amount;

  -- 3. Update the balance
  UPDATE public.organization_sms_balances
  SET 
    credit_balance = v_new_balance,
    bonus_credits_received = v_current_bonus + v_bonus_amount,
    updated_at = now()
  WHERE organization_id = p_org_id;

  -- 4. Record the usage transaction
  IF v_usage_amount > 0 THEN
    INSERT INTO public.sms_credit_transactions (
      organization_id, type, amount, description, metadata
    ) VALUES (
      p_org_id, 'usage', -v_usage_amount, 'SMS sent to ' || COALESCE(p_recipient, 'unknown'), p_payload
    );
  END IF;

  -- 5. Record the bonus transaction if there was an overdraft
  IF v_bonus_amount > 0 THEN
    INSERT INTO public.sms_credit_transactions (
      organization_id, type, amount, description, metadata
    ) VALUES (
      p_org_id, 'bonus', v_bonus_amount, 'Bonus coverage for multipart SMS to ' || COALESCE(p_recipient, 'unknown'), p_payload
    );
  END IF;

  -- Return the summary
  v_result := jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'usage_deducted', v_usage_amount,
    'bonus_applied', v_bonus_amount
  );
  
  RETURN v_result;
END;
$$;