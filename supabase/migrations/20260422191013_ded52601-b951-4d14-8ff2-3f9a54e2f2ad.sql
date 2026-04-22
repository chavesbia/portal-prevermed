DROP POLICY IF EXISTS "Admins can update aso_atendimentos" ON public.aso_atendimentos;

CREATE POLICY "Authorized operational teams can update aso_atendimentos"
ON public.aso_atendimentos
FOR UPDATE
TO authenticated
USING (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/recepcao')
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem')
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/assinatura')
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/liberacao')
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/faturamento')
)
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/recepcao')
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem')
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/assinatura')
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/liberacao')
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/faturamento')
);