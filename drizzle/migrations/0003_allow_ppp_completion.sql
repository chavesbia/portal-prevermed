DROP POLICY IF EXISTS "PPP editors can update pending" ON public.ppp_solicitacoes;
CREATE POLICY "PPP editors can update pending or complete" ON public.ppp_solicitacoes FOR UPDATE TO authenticated
USING (public.is_adm_master() OR (realizado = false AND public.can_edit_module_route(auth.uid(), '/gestao-os')))
WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));