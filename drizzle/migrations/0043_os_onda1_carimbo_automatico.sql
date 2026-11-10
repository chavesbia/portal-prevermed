ALTER TABLE public.servicos_os
  ADD COLUMN IF NOT EXISTS iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

CREATE OR REPLACE FUNCTION public.servicos_os_carimbo_automatico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _priv boolean := (auth.uid() IS NULL) OR COALESCE(public.is_adm_master(), false);
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT _priv THEN
    NEW.data_inicio := OLD.data_inicio;
    NEW.data_conclusao := OLD.data_conclusao;
    NEW.iniciado_em := OLD.iniciado_em;
    NEW.concluido_em := OLD.concluido_em;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'Não iniciado' AND NEW.status <> 'Não iniciado' THEN
      IF NEW.status = 'Encerrado' AND NOT _priv THEN
        RAISE EXCEPTION 'Inicie o serviço antes de finalizar: o início é registrado automaticamente ao clicar em Iniciar.';
      END IF;
      IF upper(NEW.tipo) = 'PCMSO' AND NOT _priv AND EXISTS (
        SELECT 1 FROM public.servicos_os p
        WHERE p.ordem_id = NEW.ordem_id AND upper(p.tipo) = 'PGR' AND p.status <> 'Encerrado'
      ) THEN
        RAISE EXCEPTION 'O PCMSO só pode ser iniciado após a conclusão do PGR desta OS.';
      END IF;
      NEW.iniciado_em := COALESCE(NEW.iniciado_em, now());
      NEW.data_inicio := COALESCE(NEW.data_inicio, _hoje);
    END IF;

    IF NEW.status = 'Encerrado' AND OLD.status <> 'Encerrado' THEN
      NEW.data_inicio := COALESCE(NEW.data_inicio, _hoje);
      NEW.iniciado_em := COALESCE(NEW.iniciado_em, now());
      IF NOT _priv OR NEW.data_conclusao IS NULL THEN NEW.data_conclusao := _hoje; END IF;
      IF NOT _priv OR NEW.concluido_em IS NULL THEN NEW.concluido_em := now(); END IF;
    ELSIF OLD.status = 'Encerrado' AND NEW.status <> 'Encerrado' THEN
      NEW.data_conclusao := NULL; NEW.concluido_em := NULL;
    ELSIF NEW.status = 'Não iniciado' THEN
      NEW.data_inicio := NULL; NEW.iniciado_em := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_servicos_os_carimbo ON public.servicos_os;
CREATE TRIGGER trg_servicos_os_carimbo BEFORE UPDATE ON public.servicos_os
  FOR EACH ROW EXECUTE FUNCTION public.servicos_os_carimbo_automatico();

CREATE OR REPLACE FUNCTION public.servicos_os_carimbo_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT COALESCE(public.is_adm_master(), false) THEN
    NEW.data_conclusao := NULL; NEW.concluido_em := NULL;
    IF NEW.status = 'Encerrado' THEN NEW.status := 'Não iniciado'; END IF;
    IF NEW.status = 'Não iniciado' THEN
      NEW.data_inicio := NULL; NEW.iniciado_em := NULL;
    ELSE
      NEW.data_inicio := (now() AT TIME ZONE 'America/Sao_Paulo')::date; NEW.iniciado_em := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_servicos_os_carimbo_ins ON public.servicos_os;
CREATE TRIGGER trg_servicos_os_carimbo_ins BEFORE INSERT ON public.servicos_os
  FOR EACH ROW EXECUTE FUNCTION public.servicos_os_carimbo_insert();

REVOKE ALL ON FUNCTION public.servicos_os_carimbo_automatico() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.servicos_os_carimbo_insert() FROM PUBLIC, anon, authenticated;