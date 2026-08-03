DROP POLICY companies_view ON public.companies;
CREATE POLICY companies_view ON public.companies FOR SELECT TO authenticated USING (true);

DROP POLICY company_units_view ON public.company_units;
CREATE POLICY company_units_view ON public.company_units FOR SELECT TO authenticated USING (true);

DROP POLICY company_contacts_view ON public.company_contacts;
CREATE POLICY company_contacts_view ON public.company_contacts FOR SELECT TO authenticated USING (true);

DROP POLICY company_responsaveis_pcmso_view ON public.company_responsaveis_pcmso;
CREATE POLICY company_responsaveis_pcmso_view ON public.company_responsaveis_pcmso FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.companies, public.company_units, public.company_contacts, public.company_responsaveis_pcmso FROM anon;