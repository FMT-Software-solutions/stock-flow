-- Migration to add SMS credit tracking and payment tables

-- 1. Organization SMS Balances Table
CREATE TABLE IF NOT EXISTS public.organization_sms_balances (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  credit_balance integer NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  bonus_credits_received integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.organization_sms_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization sms balances"
  ON public.organization_sms_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo 
      WHERE uo.organization_id = organization_sms_balances.organization_id 
      AND uo.user_id = auth.uid()
    )
  );

-- 2. SMS Credit Transactions Ledger
CREATE TABLE IF NOT EXISTS public.sms_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase', 'usage', 'bonus')),
  amount integer NOT NULL, -- positive for purchase/bonus, negative for usage
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sms_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization sms transactions"
  ON public.sms_credit_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo 
      WHERE uo.organization_id = sms_credit_transactions.organization_id 
      AND uo.user_id = auth.uid()
    )
  );

-- 3. Payment Records Ledger
CREATE TABLE IF NOT EXISTS public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_paid decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  credits_purchased integer NOT NULL,
  payment_gateway text NOT NULL DEFAULT 'paystack',
  gateway_reference text UNIQUE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization payment records"
  ON public.payment_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo 
      WHERE uo.organization_id = payment_records.organization_id 
      AND uo.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert payment records for their organization"
  ON public.payment_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations uo 
      WHERE uo.organization_id = payment_records.organization_id 
      AND uo.user_id = auth.uid()
    )
  );

-- Function and trigger to auto-create an sms balance row when an organization is created
CREATE OR REPLACE FUNCTION public.handle_new_organization_sms_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_sms_balances (organization_id, credit_balance)
  VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow safe re-running
DROP TRIGGER IF EXISTS on_organization_created_sms_balance ON public.organizations;

CREATE TRIGGER on_organization_created_sms_balance
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization_sms_balance();

-- Backfill missing balances for existing organizations
INSERT INTO public.organization_sms_balances (organization_id, credit_balance)
SELECT id, 0 FROM public.organizations
WHERE id NOT IN (SELECT organization_id FROM public.organization_sms_balances);
