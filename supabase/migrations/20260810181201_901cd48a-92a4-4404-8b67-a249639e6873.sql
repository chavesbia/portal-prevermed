DROP POLICY IF EXISTS "Admins can update laudos" ON public.laudos;
CREATE POLICY "Admins can update laudos"
  ON public.laudos FOR UPDATE TO authenticated
  USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'))
  WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));