
-- 1) Backfill: alinhar is_primary ao valor canônico is_lotacao
UPDATE public.user_departments
SET is_primary = is_lotacao
WHERE is_primary IS DISTINCT FROM is_lotacao;

-- 2) Trigger defensivo para manter sincronia
CREATE OR REPLACE FUNCTION public.sync_user_department_lotacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- is_lotacao é o canônico. is_primary sempre espelha.
  NEW.is_primary := COALESCE(NEW.is_lotacao, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_lotacao_on_user_departments ON public.user_departments;
CREATE TRIGGER sync_lotacao_on_user_departments
BEFORE INSERT OR UPDATE ON public.user_departments
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_department_lotacao();
