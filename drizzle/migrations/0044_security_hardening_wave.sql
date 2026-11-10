-- Rescisões contratuais
DROP POLICY IF EXISTS "Usuários autenticados podem ver rescisões" ON public.contract_rescisoes;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir rescisões" ON public.contract_rescisoes;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar rescisões" ON public.contract_rescisoes;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir rescisões" ON public.contract_rescisoes;
CREATE POLICY rescisoes_view ON public.contract_rescisoes FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-contratual'));
CREATE POLICY rescisoes_insert ON public.contract_rescisoes FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-contratual'));
CREATE POLICY rescisoes_update ON public.contract_rescisoes FOR UPDATE TO authenticated
  USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-contratual'))
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-contratual'));
CREATE POLICY rescisoes_delete ON public.contract_rescisoes FOR DELETE TO authenticated
  USING (public.is_adm_master());

-- Acréscimo de função (cargos)
DROP POLICY IF EXISTS "Authenticated users can select" ON public.acrescimos_funcao_cargos;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.acrescimos_funcao_cargos;
DROP POLICY IF EXISTS "Authenticated users can update" ON public.acrescimos_funcao_cargos;
CREATE POLICY acf_cargos_view ON public.acrescimos_funcao_cargos FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-os'));
CREATE POLICY acf_cargos_insert ON public.acrescimos_funcao_cargos FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));
CREATE POLICY acf_cargos_update ON public.acrescimos_funcao_cargos FOR UPDATE TO authenticated
  USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'))
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

-- Preços por empresa e responsáveis PCMSO
DROP POLICY IF EXISTS company_pricing_items_view ON public.company_pricing_items;
CREATE POLICY company_pricing_items_view ON public.company_pricing_items FOR SELECT TO authenticated
  USING (public.is_adm_master()
    OR public.can_view_module_route(auth.uid(), '/gestao-os')
    OR public.can_view_module_route(auth.uid(), '/precificacao')
    OR public.can_view_module_route(auth.uid(), '/carteira-comercial')
    OR public.can_view_module_route(auth.uid(), '/painel-cliente'));
DROP POLICY IF EXISTS company_responsaveis_pcmso_view ON public.company_responsaveis_pcmso;
CREATE POLICY company_responsaveis_pcmso_view ON public.company_responsaveis_pcmso FOR SELECT TO authenticated
  USING (public.is_adm_master()
    OR public.can_view_module_route(auth.uid(), '/gestao-os')
    OR public.can_view_module_route(auth.uid(), '/precificacao')
    OR public.can_view_module_route(auth.uid(), '/carteira-comercial')
    OR public.can_view_module_route(auth.uid(), '/painel-cliente'));

-- Propostas de renovação
DROP POLICY IF EXISTS "Authenticated can view renewal_quotations" ON public.renewal_quotations;
CREATE POLICY renewal_quotations_view ON public.renewal_quotations FOR SELECT TO authenticated
  USING (public.is_adm_master()
    OR public.can_view_module_route(auth.uid(), '/precificacao')
    OR public.can_view_module_route(auth.uid(), '/carteira-comercial'));

-- Prestadores SOC (e-mails/contatos)
DROP POLICY IF EXISTS "Autenticados leem prestadores" ON public.soc_prestadores;
CREATE POLICY soc_prestadores_view ON public.soc_prestadores FOR SELECT TO authenticated
  USING (public.is_adm_master()
    OR public.can_view_module_route(auth.uid(), '/exames-pendentes')
    OR public.can_view_module_route(auth.uid(), '/agendamentos'));

-- Históricos/auditoria: autor obrigatório = usuário logado + acesso ao módulo
DROP POLICY IF EXISTS "Authenticated users can insert historico_os" ON public.historico_os;
CREATE POLICY historico_os_insert ON public.historico_os FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-os')));
DROP POLICY IF EXISTS "Authenticated users can insert guia audit" ON public.guia_audit_log;
CREATE POLICY guia_audit_insert ON public.guia_audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-guias')));
DROP POLICY IF EXISTS "Authenticated users can insert aso_historico" ON public.aso_historico;
CREATE POLICY aso_historico_insert ON public.aso_historico FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_adm_master() OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
    WHERE m.module_route LIKE '/liberacao-asos%' AND m.can_view)));
DROP POLICY IF EXISTS ce_insert ON public.contract_eventos;
CREATE POLICY ce_insert ON public.contract_eventos FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid() AND (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-contratual')));

-- Arquivos confidenciais
DROP POLICY IF EXISTS "Acesso autenticado aos PDFs de contratos legados" ON storage.objects;
DROP POLICY IF EXISTS "Acesso autenticado aos anexos de rescisão" ON storage.objects;
CREATE POLICY "Contratual le arquivos de contratos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('contract-legados','contract-rescisoes')
    AND (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-contratual')));
CREATE POLICY "Contratual envia arquivos de contratos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('contract-legados','contract-rescisoes')
    AND (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-contratual')));
CREATE POLICY "Contratual altera arquivos de contratos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('contract-legados','contract-rescisoes')
    AND (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-contratual')));
CREATE POLICY "ADM Master exclui arquivos de contratos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('contract-legados','contract-rescisoes') AND public.is_adm_master());

DROP POLICY IF EXISTS "Auth users read os-anexos" ON storage.objects;
CREATE POLICY "Auth users read os-anexos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'os-anexos' AND (
    public.is_adm_master()
    OR (name LIKE 'soc-agenda/%' AND public.can_view_module_route(auth.uid(), '/agendamentos'))
    OR (name NOT LIKE 'soc-agenda/%' AND public.can_view_module_route(auth.uid(), '/gestao-os'))));

DROP POLICY IF EXISTS "Authenticated users read PPP attachments" ON storage.objects;
CREATE POLICY "Authenticated users read PPP attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ppp-anexos' AND (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-os')));