DROP POLICY IF EXISTS company_pricing_items_view ON public.company_pricing_items;
CREATE POLICY company_pricing_items_view ON public.company_pricing_items FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.company_pricing_items TO authenticated;