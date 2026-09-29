ALTER TABLE public.venda_itens ADD COLUMN IF NOT EXISTS tipo_comissao text NOT NULL DEFAULT 'renovacao';

CREATE TABLE public.vendas_fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor text NOT NULL,
  periodo_ini date NOT NULL,
  periodo_fim date NOT NULL,
  total_base numeric NOT NULL DEFAULT 0,
  total_comissao numeric NOT NULL DEFAULT 0,
  qtd_vendas integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vendas_fechamentos TO authenticated;
GRANT ALL ON public.vendas_fechamentos TO service_role;
ALTER TABLE public.vendas_fechamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY vfech_select ON public.vendas_fechamentos FOR SELECT TO authenticated
  USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY vfech_insert ON public.vendas_fechamentos FOR INSERT TO authenticated
  WITH CHECK (is_adm_master() OR can_approve_module_route(auth.uid(), '/gestao-vendas'));

CREATE TABLE public.vendas_fechamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES public.vendas_fechamentos(id) ON DELETE CASCADE,
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  vendedor text NOT NULL,
  base numeric NOT NULL DEFAULT 0,
  comissao numeric NOT NULL DEFAULT 0,
  UNIQUE (venda_id, vendedor)
);
GRANT SELECT, INSERT ON public.vendas_fechamento_itens TO authenticated;
GRANT ALL ON public.vendas_fechamento_itens TO service_role;
ALTER TABLE public.vendas_fechamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY vfi_select ON public.vendas_fechamento_itens FOR SELECT TO authenticated
  USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-vendas'));
CREATE POLICY vfi_insert ON public.vendas_fechamento_itens FOR INSERT TO authenticated
  WITH CHECK (is_adm_master() OR can_approve_module_route(auth.uid(), '/gestao-vendas'));

-- Trava: itens de venda já fechada não podem mudar tipo de comissão
CREATE OR REPLACE FUNCTION public.venda_itens_guard_fechada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo_comissao IS DISTINCT FROM OLD.tipo_comissao
     AND EXISTS (SELECT 1 FROM vendas_fechamento_itens WHERE venda_id = NEW.venda_id) THEN
    RAISE EXCEPTION 'Venda com comissão já fechada — não é possível alterar.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_venda_itens_guard_fechada BEFORE UPDATE ON public.venda_itens
  FOR EACH ROW EXECUTE FUNCTION public.venda_itens_guard_fechada();

CREATE OR REPLACE FUNCTION public.vendas_guard_fechada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.divisao IS DISTINCT FROM OLD.divisao OR NEW.tipo_comissao IS DISTINCT FROM OLD.tipo_comissao OR NEW.validado IS DISTINCT FROM OLD.validado)
     AND EXISTS (SELECT 1 FROM vendas_fechamento_itens WHERE venda_id = NEW.id) THEN
    RAISE EXCEPTION 'Venda com comissão já fechada — não é possível alterar.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vendas_guard_fechada BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.vendas_guard_fechada();