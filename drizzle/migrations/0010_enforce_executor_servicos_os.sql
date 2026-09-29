CREATE OR REPLACE FUNCTION public.enforce_executor_servico_os()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'Não iniciado' AND NEW.responsavel_id IS NULL THEN
    IF TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.responsavel_id IS NOT NULL THEN
      RAISE EXCEPTION 'Não é permitido iniciar ou encerrar um serviço sem executor.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_executor_servico_os ON public.servicos_os;
CREATE TRIGGER trg_enforce_executor_servico_os
BEFORE INSERT OR UPDATE ON public.servicos_os
FOR EACH ROW EXECUTE FUNCTION public.enforce_executor_servico_os();