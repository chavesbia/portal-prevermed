CREATE TABLE public.vendas_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_nome text,
  total_vendas integer NOT NULL DEFAULT 0,
  inseridas integer NOT NULL DEFAULT 0,
  atualizadas integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.vendas_importacoes TO authenticated;
GRANT ALL ON public.vendas_importacoes TO service_role;
ALTER TABLE public.vendas_importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vi_select" ON public.vendas_importacoes FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY "vi_insert" ON public.vendas_importacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY "vi_update" ON public.vendas_importacoes FOR UPDATE TO authenticated
  USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-vendas'));

CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emitente_cnpj text NOT NULL,
  emitente_nome text,
  numero_venda text NOT NULL,
  data_venda date,
  cliente_nome text,
  cliente_cnpj text,
  cliente_telefone text,
  cliente_desde date,
  qtd_vendas_cliente integer,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  vendedor_original text,
  vendedor text,
  vendedores text[] NOT NULL DEFAULT '{}',
  compartilhada boolean NOT NULL DEFAULT false,
  situacao text,
  descricao text,
  fatura text,
  nfse text,
  forma_pagamento text,
  condicao_pagamento text,
  estado text,
  cidade text,
  grupo_vendedor text,
  tipo_comissao text NOT NULL DEFAULT 'renovacao' CHECK (tipo_comissao IN ('renovacao','novo')),
  marcado_novo_por uuid,
  marcado_novo_em timestamptz,
  divisao jsonb,
  validado boolean NOT NULL DEFAULT false,
  validado_por uuid,
  validado_em timestamptz,
  importacao_id uuid REFERENCES public.vendas_importacoes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (emitente_cnpj, numero_venda)
);
CREATE INDEX idx_vendas_data ON public.vendas(data_venda);
CREATE INDEX idx_vendas_vendedor ON public.vendas(vendedor);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated;
GRANT ALL ON public.vendas TO service_role;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendas_select" ON public.vendas FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY "vendas_insert" ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY "vendas_update" ON public.vendas FOR UPDATE TO authenticated
  USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-vendas') OR public.can_approve_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY "vendas_delete" ON public.vendas FOR DELETE TO authenticated
  USING (public.is_adm_master());

CREATE TABLE public.venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  sku text,
  nome text,
  descricao text,
  quantidade numeric(12,2),
  valor_unitario numeric(14,2),
  desconto numeric(14,2),
  valor_total numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_venda_itens_venda ON public.venda_itens(venda_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_itens TO authenticated;
GRANT ALL ON public.venda_itens TO service_role;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vitens_select" ON public.venda_itens FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY "vitens_write" ON public.venda_itens FOR ALL TO authenticated
  USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-vendas'))
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-vendas'));

CREATE OR REPLACE FUNCTION public.vendas_guard_comissao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _aprova boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  _aprova := public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/gestao-vendas');
  IF (NEW.validado IS DISTINCT FROM OLD.validado) AND NOT _aprova THEN
    RAISE EXCEPTION 'Apenas o gestor pode validar a comissão.';
  END IF;
  IF OLD.validado AND NEW.validado AND NOT _aprova AND
     (NEW.tipo_comissao IS DISTINCT FROM OLD.tipo_comissao OR NEW.divisao IS DISTINCT FROM OLD.divisao) THEN
    RAISE EXCEPTION 'Comissão já validada pelo gestor.';
  END IF;
  IF NEW.tipo_comissao IS DISTINCT FROM OLD.tipo_comissao THEN
    NEW.marcado_novo_por := CASE WHEN NEW.tipo_comissao = 'novo' THEN auth.uid() ELSE NULL END;
    NEW.marcado_novo_em := CASE WHEN NEW.tipo_comissao = 'novo' THEN now() ELSE NULL END;
  END IF;
  IF NEW.validado AND NOT OLD.validado THEN
    NEW.validado_por := auth.uid(); NEW.validado_em := now();
  ELSIF NOT NEW.validado THEN
    NEW.validado_por := NULL; NEW.validado_em := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vendas_guard BEFORE UPDATE ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.vendas_guard_comissao();

INSERT INTO public.modules (name, route, icon, description, app_type, requires_permission, is_active, sort_order)
VALUES ('Gestão de Vendas', '/gestao-vendas', 'DollarSign', 'Vendas concluídas do Skywork, vendedores e fechamento de comissões', 'internal', true, true, 52);
INSERT INTO public.department_modules (department_id, module_id)
SELECT '8b148a7b-9edb-400c-a1e3-adbce2a69554', id FROM public.modules WHERE route = '/gestao-vendas';