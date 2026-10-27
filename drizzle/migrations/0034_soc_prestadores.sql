CREATE TABLE public.soc_prestadores (
  codigo text PRIMARY KEY,
  nome text NOT NULL,
  razao_social text,
  cnpj text,
  cidade text,
  uf text,
  endereco text,
  telefone text,
  celular text,
  email text,
  tipo_atendimento text,
  horario text,
  dias_atendimento text[] NOT NULL DEFAULT '{}',
  socnet boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  data_cancelamento text,
  unidade_responsavel text CHECK (unidade_responsavel IN ('lapa','osasco')),
  classificado_por uuid,
  classificado_em timestamptz,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.soc_prestadores IS 'Cópia da Tela 245 do SOC (Exporta 218830). unidade_responsavel é a única coluna do portal: vincula o prestador à Unidade Lapa/Osasco; nulo = rede credenciada externa.';
GRANT SELECT ON public.soc_prestadores TO authenticated;
GRANT UPDATE (unidade_responsavel, classificado_por, classificado_em) ON public.soc_prestadores TO authenticated;
GRANT ALL ON public.soc_prestadores TO service_role;
ALTER TABLE public.soc_prestadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem prestadores" ON public.soc_prestadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "ADM Master classifica prestadores" ON public.soc_prestadores FOR UPDATE TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());
CREATE INDEX soc_prestadores_unidade_idx ON public.soc_prestadores (unidade_responsavel) WHERE unidade_responsavel IS NOT NULL;