DROP POLICY IF EXISTS "Admins can insert laudos" ON public.laudos;
CREATE POLICY "Admins can insert laudos" ON public.laudos FOR INSERT TO authenticated
  WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS ca_insert ON public.contract_assinaturas;
CREATE POLICY ca_insert ON public.contract_assinaturas FOR INSERT TO authenticated
  WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-contratual'));

DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.correcao_retroativa_listar'::regproc);
  d := replace(d, 'can_edit_module_route(auth.uid(), ''/gestao-os/correcao-retroativa'')', 'can_view_module_route(auth.uid(), ''/gestao-os/correcao-retroativa'')');
  EXECUTE d;
  d := pg_get_functiondef('public.contract_recalc_vigencia'::regproc);
  d := replace(d, ',''parcialmente_assinado'')', ')');
  EXECUTE d;
END $$;