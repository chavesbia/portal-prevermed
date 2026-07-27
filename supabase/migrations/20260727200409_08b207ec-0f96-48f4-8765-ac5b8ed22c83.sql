CREATE TABLE public.company_responsaveis_pcmso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.company_units(id) ON DELETE SET NULL,
  nome_medico text,
  nome_conselho text,
  conselho text,
  uf_conselho text,
  email_responsavel text,
  data_inicio date,
  data_fim date,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crp_company ON public.company_responsaveis_pcmso(company_id);
CREATE INDEX idx_crp_unidade ON public.company_responsaveis_pcmso(unidade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_responsaveis_pcmso TO authenticated;
GRANT ALL ON public.company_responsaveis_pcmso TO service_role;

ALTER TABLE public.company_responsaveis_pcmso ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_responsaveis_pcmso_view ON public.company_responsaveis_pcmso
  FOR SELECT USING (is_adm_master() OR can_view_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY company_responsaveis_pcmso_insert ON public.company_responsaveis_pcmso
  FOR INSERT WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY company_responsaveis_pcmso_update ON public.company_responsaveis_pcmso
  FOR UPDATE USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY company_responsaveis_pcmso_delete ON public.company_responsaveis_pcmso
  FOR DELETE USING (is_adm_master());