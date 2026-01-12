ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their organization's discounts" ON public.discounts;
CREATE POLICY "Org users manage discounts" ON public.discounts
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can access their organization's inventory" ON public.inventory;
CREATE POLICY "Org users manage inventory" ON public.inventory
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));

