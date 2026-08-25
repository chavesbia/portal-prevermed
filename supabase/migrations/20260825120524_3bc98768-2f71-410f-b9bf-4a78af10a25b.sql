-- 1) Numeração automática
ALTER TABLE public.acrescimos_funcao_solicitacoes
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS realizado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS realizado_por_nome text;

CREATE OR REPLACE FUNCTION public.acrescimo_funcao_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ano text := to_char(COALESCE(NEW.created_at, now()), 'YYYY');
  v_next integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT COALESCE(MAX(CAST(split_part(numero, '-', 3) AS integer)), 0) + 1
      INTO v_next
      FROM public.acrescimos_funcao_solicitacoes
     WHERE split_part(numero, '-', 2) = v_ano
       AND split_part(numero, '-', 3) ~ '^[0-9]+$';
    NEW.numero := 'AF-' || v_ano || '-' || lpad(v_next::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acrescimo_funcao_set_numero ON public.acrescimos_funcao_solicitacoes;
CREATE TRIGGER trg_acrescimo_funcao_set_numero
BEFORE INSERT ON public.acrescimos_funcao_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.acrescimo_funcao_set_numero();

-- Backfill dos registros existentes
WITH ord AS (
  SELECT id, to_char(created_at, 'YYYY') AS ano,
         row_number() OVER (PARTITION BY to_char(created_at, 'YYYY') ORDER BY created_at) AS rn
  FROM public.acrescimos_funcao_solicitacoes
  WHERE numero IS NULL
)
UPDATE public.acrescimos_funcao_solicitacoes s
SET numero = 'AF-' || o.ano || '-' || lpad(o.rn::text, 4, '0')
FROM ord o WHERE o.id = s.id;

CREATE UNIQUE INDEX IF NOT EXISTS acrescimos_funcao_numero_key
  ON public.acrescimos_funcao_solicitacoes (numero);

-- 2) Permissão de exclusão (ADM Master)
GRANT DELETE ON public.acrescimos_funcao_solicitacoes TO authenticated;
GRANT DELETE ON public.acrescimos_funcao_cargos TO authenticated;

DROP POLICY IF EXISTS "ADM Master can delete solicitacoes" ON public.acrescimos_funcao_solicitacoes;
CREATE POLICY "ADM Master can delete solicitacoes"
ON public.acrescimos_funcao_solicitacoes
FOR DELETE TO authenticated
USING (public.is_adm_master());

DROP POLICY IF EXISTS "ADM Master can delete cargos" ON public.acrescimos_funcao_cargos;
CREATE POLICY "ADM Master can delete cargos"
ON public.acrescimos_funcao_cargos
FOR DELETE TO authenticated
USING (public.is_adm_master());