
-- 1) Harden permissions column defaults (least privilege)
ALTER TABLE public.permissions ALTER COLUMN can_view SET DEFAULT false;
ALTER TABLE public.permissions ALTER COLUMN can_create SET DEFAULT false;
ALTER TABLE public.permissions ALTER COLUMN can_edit SET DEFAULT false;
ALTER TABLE public.permissions ALTER COLUMN can_delete SET DEFAULT false;
ALTER TABLE public.permissions ALTER COLUMN can_approve SET DEFAULT false;

-- 2) aso_exames_atendimento SELECT gate on /liberacao-asos%
DROP POLICY IF EXISTS "Authenticated users can view aso_exames" ON public.aso_exames_atendimento;
CREATE POLICY "ASO viewers can view aso_exames"
ON public.aso_exames_atendimento FOR SELECT
USING (
  is_adm_master() OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
    WHERE m.module_route LIKE '/liberacao-asos%' AND m.can_view = true
  )
);

-- 3) client_attachments INSERT/DELETE aligned with commercial edit permission
DROP POLICY IF EXISTS "Admins can insert client_attachments" ON public.client_attachments;
DROP POLICY IF EXISTS "Admins can delete client_attachments" ON public.client_attachments;
CREATE POLICY "Commercial editors can insert client_attachments"
ON public.client_attachments FOR INSERT
WITH CHECK (
  is_adm_master() OR can_edit_module_route(auth.uid(), '/carteira-comercial')
);
CREATE POLICY "Commercial editors can delete client_attachments"
ON public.client_attachments FOR DELETE
USING (
  is_adm_master() OR can_edit_module_route(auth.uid(), '/carteira-comercial')
);

-- 4) commercial_contracts INSERT/UPDATE require edit permission
DROP POLICY IF EXISTS contracts_insert ON public.commercial_contracts;
DROP POLICY IF EXISTS contracts_update ON public.commercial_contracts;
CREATE POLICY contracts_insert ON public.commercial_contracts FOR INSERT
WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/carteira-comercial'));
CREATE POLICY contracts_update ON public.commercial_contracts FOR UPDATE
USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/carteira-comercial'))
WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/carteira-comercial'));

-- 5) Broad SELECT tables → gate by module view

-- OS group (/gestao-os)
DROP POLICY IF EXISTS "Authenticated users can view laudos" ON public.laudos;
CREATE POLICY "OS viewers can view laudos" ON public.laudos FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS "Authenticated users can view ordens_servico" ON public.ordens_servico;
CREATE POLICY "OS viewers can view ordens_servico" ON public.ordens_servico FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS "Authenticated users can view servicos_os" ON public.servicos_os;
CREATE POLICY "OS viewers can view servicos_os" ON public.servicos_os FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS os_custos_select ON public.os_custos;
CREATE POLICY os_custos_select ON public.os_custos FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS "Authenticated users can view historico_os" ON public.historico_os;
CREATE POLICY "OS viewers can view historico_os" ON public.historico_os FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-os'));

DROP POLICY IF EXISTS profissionais_select_authenticated ON public.profissionais;
CREATE POLICY profissionais_select_authenticated ON public.profissionais FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-os'));

-- ASO group (/liberacao-asos%)
DROP POLICY IF EXISTS "Authenticated users can view aso_lotes" ON public.aso_lotes_importacao;
CREATE POLICY "ASO viewers can view aso_lotes" ON public.aso_lotes_importacao FOR SELECT
USING (
  is_adm_master() OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
    WHERE m.module_route LIKE '/liberacao-asos%' AND m.can_view = true
  )
);

DROP POLICY IF EXISTS "Authenticated users can view fechamento lotes" ON public.aso_fechamento_lotes;
CREATE POLICY "ASO viewers can view fechamento lotes" ON public.aso_fechamento_lotes FOR SELECT
USING (
  is_adm_master() OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
    WHERE m.module_route LIKE '/liberacao-asos%' AND m.can_view = true
  )
);

DROP POLICY IF EXISTS "Authenticated users can view aso_historico" ON public.aso_historico;
CREATE POLICY "ASO viewers can view aso_historico" ON public.aso_historico FOR SELECT
USING (
  is_adm_master() OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
    WHERE m.module_route LIKE '/liberacao-asos%' AND m.can_view = true
  )
);

-- Guias group (/gestao-guias)
DROP POLICY IF EXISTS "Authenticated users can view guia_gestao" ON public.guia_gestao;
CREATE POLICY "Guias viewers can view guia_gestao" ON public.guia_gestao FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-guias'));

DROP POLICY IF EXISTS "Authenticated users can view imports" ON public.guia_imports;
CREATE POLICY "Guias viewers can view imports" ON public.guia_imports FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-guias'));

DROP POLICY IF EXISTS "Authenticated users can view guia audit" ON public.guia_audit_log;
CREATE POLICY "Guias viewers can view guia audit" ON public.guia_audit_log FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-guias'));

DROP POLICY IF EXISTS "Authenticated users can view prestadores_bloqueados" ON public.prestadores_bloqueados;
CREATE POLICY "Guias viewers can view prestadores_bloqueados" ON public.prestadores_bloqueados FOR SELECT
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-guias'));
