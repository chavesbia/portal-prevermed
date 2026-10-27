CREATE TABLE public.socnet_empresas (
  cnpj text PRIMARY KEY CHECK (cnpj ~ '^\d{14}$'),
  soc_code text NOT NULL CHECK (soc_code ~ '^\d{1,12}$'),
  razao_social text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.socnet_empresas TO authenticated;
GRANT ALL ON public.socnet_empresas TO service_role;
ALTER TABLE public.socnet_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adm_master gerencia empresas SOCNET" ON public.socnet_empresas
  FOR ALL TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());
COMMENT ON TABLE public.socnet_empresas IS 'Empresas de outras bases SOCNET (CNPJ -> código SOC) usadas como empresaTrabalho na busca de guias (Exporta 212792).';