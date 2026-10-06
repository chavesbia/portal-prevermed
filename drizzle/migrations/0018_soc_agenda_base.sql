CREATE TABLE public.soc_agenda_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo_agenda text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  hora_inicio time NOT NULL DEFAULT '07:00',
  hora_fim time NOT NULL DEFAULT '16:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soc_agenda_unidades TO authenticated;
GRANT ALL ON public.soc_agenda_unidades TO service_role;
ALTER TABLE public.soc_agenda_unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "soc_unid_select" ON public.soc_agenda_unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "soc_unid_admin" ON public.soc_agenda_unidades FOR ALL TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE TABLE public.soc_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE DEFAULT ('AG-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYYMMDD') || '-' || upper(substr(md5(random()::text),1,6))),
  unidade_id uuid REFERENCES public.soc_agenda_unidades(id),
  empresa_nome text,
  empresa_cnpj text,
  codigo_empresa_soc text,
  colaborador_nome text NOT NULL,
  colaborador_cpf text NOT NULL,
  tipo_exame text NOT NULL,
  exames jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_agendada date NOT NULL,
  hora_agendada time NOT NULL,
  guia_path text,
  status text NOT NULL DEFAULT 'solicitado',
  soc_retorno jsonb,
  soc_erro text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.soc_agendamentos TO authenticated;
GRANT ALL ON public.soc_agendamentos TO service_role;
ALTER TABLE public.soc_agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "soc_ag_select" ON public.soc_agendamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "soc_ag_update_admin" ON public.soc_agendamentos FOR UPDATE TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());
CREATE INDEX idx_soc_ag_data ON public.soc_agendamentos(data_agendada, unidade_id);

INSERT INTO public.soc_agenda_unidades (nome, codigo_agenda) VALUES ('PreverMed - LAPA','00830071'),('PreverMed - OSASCO','00820293');