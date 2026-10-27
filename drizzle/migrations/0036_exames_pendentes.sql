CREATE TABLE public.soc_exames_pendentes (
  id text PRIMARY KEY,
  origem text NOT NULL CHECK (origem IN ('socnet','propria')),
  sequencial_ficha text NOT NULL,
  data_ficha date,
  tipo_ficha text,
  cpf text NOT NULL,
  funcionario_nome text,
  empresa_codigo text,
  empresa_nome text,
  assessoria_nome text,
  exame_codigo text,
  exame_nome text NOT NULL,
  prestador_codigo text,
  prestador_nome text,
  data_resultado date,
  resolvido_em timestamptz,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.soc_exames_pendentes TO authenticated;
GRANT ALL ON public.soc_exames_pendentes TO service_role;
ALTER TABLE public.soc_exames_pendentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exames pendentes leitura" ON public.soc_exames_pendentes FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/exames-pendentes'));
CREATE INDEX idx_soc_exames_pendentes_abertos ON public.soc_exames_pendentes(data_ficha) WHERE data_resultado IS NULL;
CREATE INDEX idx_soc_exames_pendentes_ficha ON public.soc_exames_pendentes(sequencial_ficha);
COMMENT ON TABLE public.soc_exames_pendentes IS 'Exames por ficha copiados do SOC (SOCNET: Exporta 221785; carteira própria: futura Convocação de Exames). Pendente = data_resultado nula. Alimentada só pela rotina SOC.';

CREATE TABLE public.soc_exames_pendentes_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequencial_ficha text NOT NULL,
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 1000),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.soc_exames_pendentes_contatos TO authenticated;
GRANT ALL ON public.soc_exames_pendentes_contatos TO service_role;
ALTER TABLE public.soc_exames_pendentes_contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contatos pendentes leitura" ON public.soc_exames_pendentes_contatos FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/exames-pendentes'));
CREATE POLICY "contatos pendentes registro" ON public.soc_exames_pendentes_contatos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/exames-pendentes')));
CREATE INDEX idx_soc_exames_contatos_ficha ON public.soc_exames_pendentes_contatos(sequencial_ficha, created_at DESC);