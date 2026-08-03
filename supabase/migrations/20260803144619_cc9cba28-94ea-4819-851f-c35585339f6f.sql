DROP POLICY IF EXISTS cc_insert ON public.contract_clientes;
DROP POLICY IF EXISTS cc_update ON public.contract_clientes;

CREATE POLICY cc_insert ON public.contract_clientes
FOR INSERT TO authenticated
WITH CHECK (
  is_adm_master()
  OR can_edit_module_route(auth.uid(), '/gestao-contratual/clientes')
  OR can_edit_module_route(auth.uid(), '/gestao-contratual')
  OR can_edit_module_route(auth.uid(), '/gestao-contratual/contratos')
);

CREATE POLICY cc_update ON public.contract_clientes
FOR UPDATE TO authenticated
USING (
  is_adm_master()
  OR can_edit_module_route(auth.uid(), '/gestao-contratual/clientes')
  OR can_edit_module_route(auth.uid(), '/gestao-contratual')
  OR can_edit_module_route(auth.uid(), '/gestao-contratual/contratos')
)
WITH CHECK (
  is_adm_master()
  OR can_edit_module_route(auth.uid(), '/gestao-contratual/clientes')
  OR can_edit_module_route(auth.uid(), '/gestao-contratual')
  OR can_edit_module_route(auth.uid(), '/gestao-contratual/contratos')
);