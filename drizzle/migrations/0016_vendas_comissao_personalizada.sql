ALTER TABLE public.venda_itens ADD COLUMN IF NOT EXISTS taxa_personalizada numeric;
ALTER TABLE public.vendas_fechamentos ADD COLUMN IF NOT EXISTS autorizado_por_nome text;
CREATE OR REPLACE FUNCTION public.venda_itens_guard_fechada()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.tipo_comissao IS DISTINCT FROM OLD.tipo_comissao OR NEW.taxa_personalizada IS DISTINCT FROM OLD.taxa_personalizada)
     AND EXISTS (SELECT 1 FROM vendas_fechamento_itens WHERE venda_id = NEW.venda_id) THEN
    RAISE EXCEPTION 'Venda com comissão já fechada — não é possível alterar.';
  END IF;
  RETURN NEW;
END $function$;