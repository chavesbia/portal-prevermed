
-- Enums for guia management
CREATE TYPE public.compareceu_status AS ENUM ('NAO_INFORMADO', 'COMPARECEU', 'NAO_COMPARECEU', 'REMARCADO', 'PARCIAL');
CREATE TYPE public.sim_nao_status AS ENUM ('NAO_INFORMADO', 'SIM', 'NAO');

-- Main guias table
CREATE TABLE public.guias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guia_codigo TEXT NOT NULL UNIQUE,
  data_guia DATE,
  medico_codigo TEXT,
  medico_nome TEXT,
  tipo_exame TEXT,
  situacao TEXT,
  atendido_texto TEXT,
  funcionario_codigo TEXT,
  funcionario_nome TEXT,
  funcionario_cpf TEXT,
  prestador_codigo TEXT,
  prestador_nome TEXT,
  prestador_email TEXT,
  prestador_telefone TEXT,
  prestador_socnet_codigo TEXT,
  prestador_socnet_nome TEXT,
  empresa_codigo TEXT,
  empresa_nome TEXT,
  unidade_nome TEXT,
  data_agendamento DATE,
  hora_agendamento TEXT,
  pedido_codigo_sequencial TEXT,
  solicitante_nome TEXT,
  last_seen_at TIMESTAMPTZ,
  last_import_at TIMESTAMPTZ,
  last_import_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guia exames (multiple exams per guia)
CREATE TABLE public.guia_exames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guia_id UUID NOT NULL REFERENCES public.guias(id) ON DELETE CASCADE,
  guia_codigo TEXT NOT NULL,
  exame_codigo TEXT,
  exame_nome TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guia management/operational status
CREATE TABLE public.guia_gestao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guia_id UUID NOT NULL REFERENCES public.guias(id) ON DELETE CASCADE UNIQUE,
  guia_codigo TEXT NOT NULL UNIQUE,
  compareceu_status compareceu_status NOT NULL DEFAULT 'NAO_INFORMADO',
  atendimento_lancado sim_nao_status NOT NULL DEFAULT 'NAO_INFORMADO',
  aso_anexado sim_nao_status NOT NULL DEFAULT 'NAO_INFORMADO',
  observacoes TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guia-specific audit log (separate from portal audit_log)
CREATE TABLE public.guia_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_name TEXT,
  guia_codigo TEXT,
  campo TEXT NOT NULL,
  valor_antigo TEXT,
  valor_novo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guia imports log
CREATE TABLE public.guia_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imported_by UUID,
  imported_by_name TEXT,
  file_name TEXT,
  file_size INTEGER,
  total_rows_lidas INTEGER,
  total_guias_criadas INTEGER,
  total_guias_atualizadas INTEGER,
  total_exames_criados INTEGER,
  total_exames_atualizados INTEGER,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feriados table for SLA calculation
CREATE TABLE public.feriados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.guias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guia_exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guia_gestao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guia_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guia_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

-- RLS policies for guias (authenticated users can view, admins can manage)
CREATE POLICY "Authenticated users can view guias" ON public.guias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert guias" ON public.guias FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update guias" ON public.guias FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete guias" ON public.guias FOR DELETE TO authenticated USING (is_adm_master());

-- RLS for guia_exames
CREATE POLICY "Authenticated users can view guia_exames" ON public.guia_exames FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert guia_exames" ON public.guia_exames FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update guia_exames" ON public.guia_exames FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete guia_exames" ON public.guia_exames FOR DELETE TO authenticated USING (is_adm_master());

-- RLS for guia_gestao (admins and department users can edit)
CREATE POLICY "Authenticated users can view guia_gestao" ON public.guia_gestao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert guia_gestao" ON public.guia_gestao FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update guia_gestao" ON public.guia_gestao FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete guia_gestao" ON public.guia_gestao FOR DELETE TO authenticated USING (is_adm_master());

-- RLS for guia_audit_log
CREATE POLICY "Authenticated users can view guia audit" ON public.guia_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert guia audit" ON public.guia_audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- RLS for guia_imports
CREATE POLICY "Authenticated users can view imports" ON public.guia_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert imports" ON public.guia_imports FOR INSERT TO authenticated WITH CHECK (is_admin());

-- RLS for feriados
CREATE POLICY "Everyone can view feriados" ON public.feriados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage feriados" ON public.feriados FOR ALL TO authenticated USING (is_adm_master()) WITH CHECK (is_adm_master());

-- Triggers for updated_at
CREATE TRIGGER update_guias_updated_at BEFORE UPDATE ON public.guias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guia_exames_updated_at BEFORE UPDATE ON public.guia_exames FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guia_gestao_updated_at BEFORE UPDATE ON public.guia_gestao FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
