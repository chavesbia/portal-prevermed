
-- =========================
-- Módulo: Retificação de ASOs
-- =========================

-- Tabelas de catálogo (configuráveis)
CREATE TABLE public.aso_retificacao_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE public.aso_retificacao_motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE public.aso_retificacao_medicos_examinadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  crm text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Tabela principal de solicitações
CREATE TABLE public.aso_retificacao_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_solicitacao timestamptz NOT NULL DEFAULT now(),
  empresa text NOT NULL,
  cnpj text NOT NULL,
  unidade text,
  colaborador_nome text NOT NULL,
  colaborador_cpf text NOT NULL,
  area_id uuid REFERENCES public.aso_retificacao_areas(id) ON DELETE RESTRICT,
  motivo_id uuid REFERENCES public.aso_retificacao_motivos(id) ON DELETE RESTRICT,
  descricao text NOT NULL,
  data_retificacao date,
  medico_examinador_id uuid REFERENCES public.aso_retificacao_medicos_examinadores(id) ON DELETE SET NULL,
  responsavel_retificacao_id uuid,
  observacoes text,
  created_by uuid NOT NULL,
  created_by_name text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aso_ret_solic_cnpj ON public.aso_retificacao_solicitacoes(cnpj);
CREATE INDEX idx_aso_ret_solic_cpf ON public.aso_retificacao_solicitacoes(colaborador_cpf);
CREATE INDEX idx_aso_ret_solic_data ON public.aso_retificacao_solicitacoes(data_solicitacao DESC);

-- Anexos
CREATE TABLE public.aso_retificacao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.aso_retificacao_solicitacoes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aso_ret_anexos_solic ON public.aso_retificacao_anexos(solicitacao_id);

-- Triggers updated_at
CREATE TRIGGER trg_aso_ret_areas_updated_at BEFORE UPDATE ON public.aso_retificacao_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_aso_ret_motivos_updated_at BEFORE UPDATE ON public.aso_retificacao_motivos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_aso_ret_medicos_updated_at BEFORE UPDATE ON public.aso_retificacao_medicos_examinadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_aso_ret_solic_updated_at BEFORE UPDATE ON public.aso_retificacao_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.aso_retificacao_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aso_retificacao_motivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aso_retificacao_medicos_examinadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aso_retificacao_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aso_retificacao_anexos ENABLE ROW LEVEL SECURITY;

-- Catálogos: leitura para qualquer usuário com acesso ao módulo; escrita apenas adm_master
CREATE POLICY "Catálogo áreas - leitura autenticada"
  ON public.aso_retificacao_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo áreas - escrita adm_master"
  ON public.aso_retificacao_areas FOR ALL TO authenticated
  USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE POLICY "Catálogo motivos - leitura autenticada"
  ON public.aso_retificacao_motivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo motivos - escrita adm_master"
  ON public.aso_retificacao_motivos FOR ALL TO authenticated
  USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE POLICY "Catálogo médicos - leitura autenticada"
  ON public.aso_retificacao_medicos_examinadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo médicos - escrita adm_master"
  ON public.aso_retificacao_medicos_examinadores FOR ALL TO authenticated
  USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

-- Solicitações: leitura/escrita conforme permissões do módulo /retificacao-asos
CREATE POLICY "Solicitações - leitura"
  ON public.aso_retificacao_solicitacoes FOR SELECT TO authenticated
  USING (
    public.is_adm_master()
    OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
      WHERE gum.module_route = '/retificacao-asos' AND gum.can_view = true
    )
  );

CREATE POLICY "Solicitações - inserir"
  ON public.aso_retificacao_solicitacoes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      public.is_adm_master()
      OR EXISTS (
        SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
        WHERE gum.module_route = '/retificacao-asos' AND gum.can_create = true
      )
    )
  );

CREATE POLICY "Solicitações - atualizar"
  ON public.aso_retificacao_solicitacoes FOR UPDATE TO authenticated
  USING (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/retificacao-asos')
  )
  WITH CHECK (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/retificacao-asos')
  );

CREATE POLICY "Solicitações - excluir adm_master"
  ON public.aso_retificacao_solicitacoes FOR DELETE TO authenticated
  USING (public.is_adm_master());

-- Anexos: mesma lógica
CREATE POLICY "Anexos - leitura"
  ON public.aso_retificacao_anexos FOR SELECT TO authenticated
  USING (
    public.is_adm_master()
    OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
      WHERE gum.module_route = '/retificacao-asos' AND gum.can_view = true
    )
  );

CREATE POLICY "Anexos - inserir"
  ON public.aso_retificacao_anexos FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by AND (
      public.is_adm_master()
      OR public.can_edit_module_route(auth.uid(), '/retificacao-asos')
      OR EXISTS (
        SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
        WHERE gum.module_route = '/retificacao-asos' AND gum.can_create = true
      )
    )
  );

CREATE POLICY "Anexos - excluir"
  ON public.aso_retificacao_anexos FOR DELETE TO authenticated
  USING (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/retificacao-asos')
  );

-- Storage bucket privado para anexos
INSERT INTO storage.buckets (id, name, public) VALUES ('aso-retificacao-anexos', 'aso-retificacao-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Retificação anexos - listar/ler"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'aso-retificacao-anexos' AND (
      public.is_adm_master()
      OR EXISTS (
        SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
        WHERE gum.module_route = '/retificacao-asos' AND gum.can_view = true
      )
    )
  );

CREATE POLICY "Retificação anexos - upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'aso-retificacao-anexos' AND (
      public.is_adm_master()
      OR public.can_edit_module_route(auth.uid(), '/retificacao-asos')
      OR EXISTS (
        SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
        WHERE gum.module_route = '/retificacao-asos' AND gum.can_create = true
      )
    )
  );

CREATE POLICY "Retificação anexos - excluir"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'aso-retificacao-anexos' AND (
      public.is_adm_master()
      OR public.can_edit_module_route(auth.uid(), '/retificacao-asos')
    )
  );

-- Seeds dos catálogos
INSERT INTO public.aso_retificacao_areas (nome) VALUES
  ('Atendimento'),('Engenharia'),('Enfermagem')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.aso_retificacao_motivos (nome) VALUES
  ('Duplicidade'),('Erro cadastral'),('Riscos'),('Exames'),('Médico Coordenador'),('Reaproveitamento')
ON CONFLICT (nome) DO NOTHING;

-- Registrar o módulo
INSERT INTO public.modules (id, name, route, icon, is_active, description)
VALUES (gen_random_uuid(), 'Retificação de ASOs', '/retificacao-asos', 'FileEdit', true, 'Controle de solicitações de retificação de ASOs')
ON CONFLICT DO NOTHING;

-- Vincular ao departamento Atendimento (módulo principal)
INSERT INTO public.department_modules (department_id, module_id)
SELECT 'a1d74a73-d016-4e41-b2ac-6bdc8a96df97', id FROM public.modules WHERE route = '/retificacao-asos'
ON CONFLICT DO NOTHING;
