ALTER TABLE public.contract_rescisoes ADD COLUMN IF NOT EXISTS numero text;

CREATE OR REPLACE FUNCTION public.rescisao_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano text := to_char(COALESCE(NEW.created_at, now()), 'YYYY');
  v_seq integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT COALESCE(MAX(CAST(split_part(numero, '-', 3) AS integer)), 0) + 1
      INTO v_seq
      FROM public.contract_rescisoes
     WHERE numero LIKE 'RSC-' || v_ano || '-%'
       AND split_part(numero, '-', 3) ~ '^[0-9]+$';
    NEW.numero := 'RSC-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rescisao_set_numero ON public.contract_rescisoes;
CREATE TRIGGER trg_rescisao_set_numero
BEFORE INSERT ON public.contract_rescisoes
FOR EACH ROW EXECUTE FUNCTION public.rescisao_set_numero();

WITH ordered AS (
  SELECT id, to_char(created_at, 'YYYY') AS ano,
         row_number() OVER (PARTITION BY to_char(created_at, 'YYYY') ORDER BY created_at) AS rn
  FROM public.contract_rescisoes
  WHERE numero IS NULL
)
UPDATE public.contract_rescisoes r
SET numero = 'RSC-' || o.ano || '-' || lpad(o.rn::text, 4, '0')
FROM ordered o
WHERE r.id = o.id;