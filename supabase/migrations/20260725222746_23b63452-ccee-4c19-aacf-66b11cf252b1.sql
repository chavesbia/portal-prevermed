CREATE TABLE public.company_units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  soc_unit_code text NOT NULL,
  name text,
  razao_social text,
  risk_grade text,
  is_active boolean NOT NULL DEFAULT true,
  cnpj text,
  cpf text,
  inscricao_estadual text,
  codigo_cliente_integracao text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_units TO authenticated;
GRANT ALL ON public.company_units TO service_role;

CREATE UNIQUE INDEX company_units_company_soc_unit_key
  ON public.company_units (company_id, soc_unit_code);
CREATE INDEX idx_company_units_company_id ON public.company_units (company_id);
CREATE INDEX idx_company_units_cnpj ON public.company_units (cnpj);

ALTER TABLE public.company_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_units_view" ON public.company_units
  FOR SELECT USING (is_adm_master() OR can_view_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY "company_units_insert" ON public.company_units
  FOR INSERT WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY "company_units_update" ON public.company_units
  FOR UPDATE USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'));

CREATE POLICY "company_units_delete" ON public.company_units
  FOR DELETE USING (is_adm_master());

CREATE TRIGGER update_company_units_updated_at
  BEFORE UPDATE ON public.company_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();