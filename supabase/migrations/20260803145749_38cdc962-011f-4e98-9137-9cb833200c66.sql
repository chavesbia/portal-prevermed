DROP POLICY IF EXISTS ct_view ON public.contract_templates;
CREATE POLICY ct_view ON public.contract_templates FOR SELECT TO authenticated
USING (
  is_adm_master()
  OR can_view_module_route(auth.uid(), '/gestao-contratual/modelos')
  OR can_view_module_route(auth.uid(), '/gestao-contratual/contratos')
  OR can_view_module_route(auth.uid(), '/gestao-contratual')
);

DROP POLICY IF EXISTS ctv_view ON public.contract_template_versions;
CREATE POLICY ctv_view ON public.contract_template_versions FOR SELECT TO authenticated
USING (
  is_adm_master()
  OR can_view_module_route(auth.uid(), '/gestao-contratual/modelos')
  OR can_view_module_route(auth.uid(), '/gestao-contratual/contratos')
  OR can_view_module_route(auth.uid(), '/gestao-contratual')
);