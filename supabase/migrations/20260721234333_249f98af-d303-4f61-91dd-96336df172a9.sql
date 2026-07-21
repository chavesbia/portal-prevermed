
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  soc_code TEXT NOT NULL UNIQUE,
  cnpj TEXT UNIQUE,
  nome_abreviado TEXT,
  razao_social TEXT NOT NULL,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  codigo_cliente_integracao TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_view" ON public.companies FOR SELECT
  USING (is_adm_master() OR can_view_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY "companies_insert" ON public.companies FOR INSERT
  WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY "companies_update" ON public.companies FOR UPDATE
  USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY "companies_delete" ON public.companies FOR DELETE
  USING (is_adm_master());

CREATE INDEX idx_companies_soc_code ON public.companies(soc_code);
CREATE INDEX idx_companies_cnpj ON public.companies(cnpj);

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
