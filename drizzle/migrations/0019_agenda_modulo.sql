CREATE TABLE public.agenda_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.soc_agenda_unidades(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL DEFAULT '07:00',
  hora_fim time NOT NULL DEFAULT '16:00',
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (unidade_id, dia_semana)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_calendario TO authenticated;
GRANT ALL ON public.agenda_calendario TO service_role;
ALTER TABLE public.agenda_calendario ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_cal_admin ON public.agenda_calendario FOR ALL TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE TABLE public.agenda_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES public.soc_agenda_unidades(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora_fim_antecipada time,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_bloqueios TO authenticated;
GRANT ALL ON public.agenda_bloqueios TO service_role;
ALTER TABLE public.agenda_bloqueios ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_bloq_admin ON public.agenda_bloqueios FOR ALL TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE TABLE public.agenda_exames_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exame_nome text NOT NULL,
  unidade_id uuid REFERENCES public.soc_agenda_unidades(id) ON DELETE CASCADE,
  dias_semana smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  hora_inicio time NOT NULL DEFAULT '07:00',
  hora_fim time NOT NULL DEFAULT '16:00',
  antecedencia_dias integer NOT NULL DEFAULT 0 CHECK (antecedencia_dias >= 0),
  parceiro boolean NOT NULL DEFAULT false,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_exames_regras TO authenticated;
GRANT ALL ON public.agenda_exames_regras TO service_role;
ALTER TABLE public.agenda_exames_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_regras_admin ON public.agenda_exames_regras FOR ALL TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE TABLE public.agenda_limites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES public.soc_agenda_unidades(id) ON DELETE CASCADE,
  tipo_exame text NOT NULL,
  dia_semana smallint CHECK (dia_semana BETWEEN 0 AND 6),
  maximo integer NOT NULL CHECK (maximo >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_limites TO authenticated;
GRANT ALL ON public.agenda_limites TO service_role;
ALTER TABLE public.agenda_limites ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_lim_admin ON public.agenda_limites FOR ALL TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE TABLE public.agenda_documentos_exigidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_exame text NOT NULL,
  nome text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_documentos_exigidos TO authenticated;
GRANT ALL ON public.agenda_documentos_exigidos TO service_role;
ALTER TABLE public.agenda_documentos_exigidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_docs_admin ON public.agenda_documentos_exigidos FOR ALL TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

INSERT INTO public.agenda_documentos_exigidos (tipo_exame, nome, obrigatorio, ordem) VALUES
 ('Retorno ao Trabalho', 'Comunicado do INSS', false, 1),
 ('Retorno ao Trabalho', 'Alta Médica', true, 2),
 ('Retorno ao Trabalho', 'Laudo do Especialista', false, 3),
 ('Retorno ao Trabalho', 'Outros', false, 4);

INSERT INTO public.agenda_calendario (unidade_id, dia_semana, hora_inicio, hora_fim)
SELECT u.id, d, u.hora_inicio, u.hora_fim FROM public.soc_agenda_unidades u, generate_series(1,5) d
ON CONFLICT DO NOTHING;

ALTER TABLE public.soc_agendamentos
  ADD COLUMN IF NOT EXISTS motivo_retorno text,
  ADD COLUMN IF NOT EXISTS aprovacao_status text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS devolucao_motivo text;

CREATE TABLE public.soc_agendamento_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.soc_agendamentos(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  nome_arquivo text,
  path text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.soc_agendamento_anexos TO authenticated;
GRANT ALL ON public.soc_agendamento_anexos TO service_role;
ALTER TABLE public.soc_agendamento_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY soc_anexos_select ON public.soc_agendamento_anexos FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/agendamentos'));

-- Dados pessoais (CPF) só para quem tem o módulo Agendamentos
DROP POLICY IF EXISTS soc_ag_select ON public.soc_agendamentos;
CREATE POLICY soc_ag_select ON public.soc_agendamentos FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/agendamentos'));

INSERT INTO public.modules (name, description, icon, route, requires_permission, sort_order)
SELECT 'Agendamentos', 'Agendamentos de exames, kits, aprovação de documentação e indicadores', 'CalendarCheck', '/agendamentos', true, 50
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE route = '/agendamentos');