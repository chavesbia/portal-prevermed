ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS dia_contagem text,
  ADD COLUMN IF NOT EXISTS tipo_contagem text,
  ADD COLUMN IF NOT EXISTS tipo_relatorio_fatura text;

CREATE TABLE IF NOT EXISTS public.company_pricing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  soc_product_code text,
  product_name text,
  product_group_code text,
  product_group_name text,
  exames text,
  valor_produto_pontual numeric,
  valor_vida_mes numeric,
  valor_mensal numeric,
  valor_anual numeric,
  valor_total_parcela numeric,
  valor_minimo numeric,
  minimo_vidas integer,
  dia_cobranca text,
  tipo_cobranca text,
  valor_evento numeric,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_pricing_items TO authenticated;
GRANT ALL ON public.company_pricing_items TO service_role;

ALTER TABLE public.company_pricing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_pricing_items_view ON public.company_pricing_items
  FOR SELECT USING (is_adm_master() OR can_view_module_route(auth.uid(), '/admin/empresas'));
CREATE POLICY company_pricing_items_insert ON public.company_pricing_items
  FOR INSERT WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'));
CREATE POLICY company_pricing_items_update ON public.company_pricing_items
  FOR UPDATE USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'));
CREATE POLICY company_pricing_items_delete ON public.company_pricing_items
  FOR DELETE USING (is_adm_master());

CREATE UNIQUE INDEX IF NOT EXISTS company_pricing_items_company_product_key
  ON public.company_pricing_items (company_id, soc_product_code);