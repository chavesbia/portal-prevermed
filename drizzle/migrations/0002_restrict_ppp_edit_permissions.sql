DROP POLICY IF EXISTS "Authenticated users can insert PPP" ON public.ppp_solicitacoes;
CREATE POLICY "PPP editors can insert" ON public.ppp_solicitacoes FOR INSERT TO authenticated
WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS "Authenticated users can update PPP" ON public.ppp_solicitacoes;
CREATE POLICY "PPP editors can update pending" ON public.ppp_solicitacoes FOR UPDATE TO authenticated
USING (public.is_adm_master() OR (realizado = false AND public.can_edit_module_route(auth.uid(), '/gestao-os')))
WITH CHECK (public.is_adm_master() OR (realizado = false AND public.can_edit_module_route(auth.uid(), '/gestao-os')));

DROP POLICY IF EXISTS "Authenticated users can insert PPP periods" ON public.ppp_periodos;
CREATE POLICY "PPP editors can insert periods" ON public.ppp_periodos FOR INSERT TO authenticated
WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS "Authenticated users can update PPP periods" ON public.ppp_periodos;
CREATE POLICY "PPP editors can update periods" ON public.ppp_periodos FOR UPDATE TO authenticated
USING (public.is_adm_master() OR EXISTS (SELECT 1 FROM public.ppp_solicitacoes s WHERE s.id = ppp_periodos.solicitacao_id AND s.realizado = false AND public.can_edit_module_route(auth.uid(), '/gestao-os')))
WITH CHECK (public.is_adm_master() OR EXISTS (SELECT 1 FROM public.ppp_solicitacoes s WHERE s.id = ppp_periodos.solicitacao_id AND s.realizado = false AND public.can_edit_module_route(auth.uid(), '/gestao-os')));

DROP POLICY IF EXISTS "Authenticated users can insert PPP attachments" ON public.ppp_anexos;
CREATE POLICY "PPP editors can insert attachments" ON public.ppp_anexos FOR INSERT TO authenticated
WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS "Authenticated users can update PPP attachments" ON public.ppp_anexos;
CREATE POLICY "PPP editors can update attachments" ON public.ppp_anexos FOR UPDATE TO authenticated
USING (public.is_adm_master() OR EXISTS (SELECT 1 FROM public.ppp_solicitacoes s WHERE s.id = ppp_anexos.solicitacao_id AND s.realizado = false AND public.can_edit_module_route(auth.uid(), '/gestao-os')))
WITH CHECK (public.is_adm_master() OR EXISTS (SELECT 1 FROM public.ppp_solicitacoes s WHERE s.id = ppp_anexos.solicitacao_id AND s.realizado = false AND public.can_edit_module_route(auth.uid(), '/gestao-os')));