DROP POLICY IF EXISTS "Authorized users can update aso_exames" ON public.aso_exames_atendimento;

CREATE POLICY "Only nursing or admin can update aso_exames"
ON public.aso_exames_atendimento
FOR UPDATE
TO authenticated
USING (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem')
)
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem')
);

DROP POLICY IF EXISTS "Admins can insert aso_exames" ON public.aso_exames_atendimento;

CREATE POLICY "Only nursing or admin can insert aso_exames"
ON public.aso_exames_atendimento
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem')
);

DROP POLICY IF EXISTS "Admins can delete aso_exames" ON public.aso_exames_atendimento;

CREATE POLICY "Only nursing or admin can delete aso_exames"
ON public.aso_exames_atendimento
FOR DELETE
TO authenticated
USING (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem')
);