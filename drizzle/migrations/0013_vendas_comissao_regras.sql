CREATE TABLE public.vendas_comissao_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio date NOT NULL UNIQUE,
  taxa_novo numeric(6,4) NOT NULL CHECK (taxa_novo >= 0 AND taxa_novo <= 1),
  taxa_renovacao numeric(6,4) NOT NULL CHECK (taxa_renovacao >= 0 AND taxa_renovacao <= 1),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.vendas_comissao_regras TO authenticated;
GRANT ALL ON public.vendas_comissao_regras TO service_role;
ALTER TABLE public.vendas_comissao_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver regras" ON public.vendas_comissao_regras FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY "criar regras" ON public.vendas_comissao_regras FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY "excluir regras futuras" ON public.vendas_comissao_regras FOR DELETE TO authenticated
  USING ((public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/gestao-vendas')) AND vigencia_inicio > current_date);
INSERT INTO public.vendas_comissao_regras (vigencia_inicio, taxa_novo, taxa_renovacao) VALUES ('2000-01-01', 0.03, 0.01);