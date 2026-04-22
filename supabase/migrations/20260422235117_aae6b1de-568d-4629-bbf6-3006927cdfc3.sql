ALTER TABLE public.aso_atendimentos
ADD COLUMN IF NOT EXISTS processo_iniciado_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS importado_entrada_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS importado_saida_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recepcao_entrada_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recepcao_saida_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exames_entrada_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exames_saida_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assinatura_entrada_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assinatura_saida_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS liberacao_entrada_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS liberacao_saida_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS faturamento_entrada_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS faturamento_saida_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.aso_build_atendimento_timestamp(_data date, _hora text)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  hora_normalizada text;
  base_ts timestamp;
BEGIN
  IF _data IS NULL THEN
    RETURN NULL;
  END IF;

  hora_normalizada := NULLIF(trim(COALESCE(_hora, '')), '');

  BEGIN
    IF hora_normalizada IS NOT NULL THEN
      IF hora_normalizada ~ '^\d{2}:\d{2}:\d{2}$' THEN
        base_ts := (_data::text || ' ' || hora_normalizada)::timestamp;
      ELSIF hora_normalizada ~ '^\d{2}:\d{2}$' THEN
        base_ts := (_data::text || ' ' || hora_normalizada || ':00')::timestamp;
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    base_ts := NULL;
  END;

  IF base_ts IS NULL THEN
    base_ts := (_data::text || ' 00:00:00')::timestamp;
  END IF;

  RETURN base_ts AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

CREATE OR REPLACE FUNCTION public.aso_status_to_stage(_status public.aso_status)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _status
    WHEN 'importado' THEN 'importado'
    WHEN 'em_triagem' THEN 'recepcao'
    WHEN 'aguardando_exames' THEN 'exames'
    WHEN 'pronto_assinatura_medica' THEN 'assinatura'
    WHEN 'em_escaneamento' THEN 'liberacao'
    WHEN 'liberado' THEN 'liberacao'
    WHEN 'liberado_faturamento' THEN 'faturamento'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.track_aso_stage_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  started_at timestamptz;
  old_stage text;
  new_stage text;
  transition_time timestamptz := now();
BEGIN
  started_at := COALESCE(
    NEW.processo_iniciado_em,
    public.aso_build_atendimento_timestamp(NEW.data_atendimento, NEW.hora_inicial),
    NEW.created_at,
    transition_time
  );

  IF TG_OP = 'INSERT' THEN
    NEW.processo_iniciado_em := started_at;
    NEW.importado_entrada_em := COALESCE(NEW.importado_entrada_em, started_at);

    new_stage := public.aso_status_to_stage(NEW.status);

    CASE new_stage
      WHEN 'recepcao' THEN NEW.recepcao_entrada_em := COALESCE(NEW.recepcao_entrada_em, transition_time);
      WHEN 'exames' THEN NEW.exames_entrada_em := COALESCE(NEW.exames_entrada_em, transition_time);
      WHEN 'assinatura' THEN NEW.assinatura_entrada_em := COALESCE(NEW.assinatura_entrada_em, transition_time);
      WHEN 'liberacao' THEN NEW.liberacao_entrada_em := COALESCE(NEW.liberacao_entrada_em, transition_time);
      WHEN 'faturamento' THEN NEW.faturamento_entrada_em := COALESCE(NEW.faturamento_entrada_em, transition_time);
    END CASE;

    RETURN NEW;
  END IF;

  NEW.processo_iniciado_em := started_at;
  NEW.importado_entrada_em := COALESCE(NEW.importado_entrada_em, OLD.importado_entrada_em, started_at);

  old_stage := public.aso_status_to_stage(OLD.status);
  new_stage := public.aso_status_to_stage(NEW.status);

  IF NEW.status IS DISTINCT FROM OLD.status AND old_stage IS DISTINCT FROM new_stage THEN
    CASE old_stage
      WHEN 'importado' THEN NEW.importado_saida_em := COALESCE(NEW.importado_saida_em, OLD.importado_saida_em, transition_time);
      WHEN 'recepcao' THEN NEW.recepcao_saida_em := COALESCE(NEW.recepcao_saida_em, OLD.recepcao_saida_em, transition_time);
      WHEN 'exames' THEN NEW.exames_saida_em := COALESCE(NEW.exames_saida_em, OLD.exames_saida_em, transition_time);
      WHEN 'assinatura' THEN NEW.assinatura_saida_em := COALESCE(NEW.assinatura_saida_em, OLD.assinatura_saida_em, transition_time);
      WHEN 'liberacao' THEN NEW.liberacao_saida_em := COALESCE(NEW.liberacao_saida_em, OLD.liberacao_saida_em, transition_time);
      WHEN 'faturamento' THEN NEW.faturamento_saida_em := COALESCE(NEW.faturamento_saida_em, OLD.faturamento_saida_em, transition_time);
    END CASE;

    CASE new_stage
      WHEN 'recepcao' THEN NEW.recepcao_entrada_em := COALESCE(OLD.recepcao_entrada_em, NEW.recepcao_entrada_em, transition_time);
      WHEN 'exames' THEN NEW.exames_entrada_em := COALESCE(OLD.exames_entrada_em, NEW.exames_entrada_em, transition_time);
      WHEN 'assinatura' THEN NEW.assinatura_entrada_em := COALESCE(OLD.assinatura_entrada_em, NEW.assinatura_entrada_em, transition_time);
      WHEN 'liberacao' THEN NEW.liberacao_entrada_em := COALESCE(OLD.liberacao_entrada_em, NEW.liberacao_entrada_em, transition_time);
      WHEN 'faturamento' THEN NEW.faturamento_entrada_em := COALESCE(OLD.faturamento_entrada_em, NEW.faturamento_entrada_em, transition_time);
    END CASE;
  END IF;

  IF OLD.fechamento_lote_id IS NULL AND NEW.fechamento_lote_id IS NOT NULL THEN
    NEW.faturamento_saida_em := COALESCE(NEW.faturamento_saida_em, OLD.faturamento_saida_em, transition_time);
    NEW.finalizado_em := COALESCE(NEW.finalizado_em, OLD.finalizado_em, transition_time);
  ELSIF OLD.status <> ALL (ARRAY['fechado'::public.aso_status, 'finalizado'::public.aso_status])
    AND NEW.status = ANY (ARRAY['fechado'::public.aso_status, 'finalizado'::public.aso_status]) THEN
    NEW.faturamento_saida_em := COALESCE(NEW.faturamento_saida_em, OLD.faturamento_saida_em, transition_time);
    NEW.finalizado_em := COALESCE(NEW.finalizado_em, OLD.finalizado_em, transition_time);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_aso_stage_timestamps ON public.aso_atendimentos;
CREATE TRIGGER track_aso_stage_timestamps
BEFORE INSERT OR UPDATE ON public.aso_atendimentos
FOR EACH ROW
EXECUTE FUNCTION public.track_aso_stage_timestamps();

UPDATE public.aso_atendimentos
SET
  processo_iniciado_em = COALESCE(processo_iniciado_em, public.aso_build_atendimento_timestamp(data_atendimento, hora_inicial), created_at),
  importado_entrada_em = COALESCE(importado_entrada_em, public.aso_build_atendimento_timestamp(data_atendimento, hora_inicial), created_at),
  recepcao_entrada_em = COALESCE(recepcao_entrada_em, CASE WHEN status = 'em_triagem' THEN now() END),
  exames_entrada_em = COALESCE(exames_entrada_em, CASE WHEN status = 'aguardando_exames' THEN now() END),
  assinatura_entrada_em = COALESCE(assinatura_entrada_em, CASE WHEN status = 'pronto_assinatura_medica' THEN now() END),
  liberacao_entrada_em = COALESCE(liberacao_entrada_em, CASE WHEN status IN ('em_escaneamento', 'liberado') THEN now() END),
  faturamento_entrada_em = COALESCE(faturamento_entrada_em, CASE WHEN status = 'liberado_faturamento' THEN now() END),
  finalizado_em = COALESCE(finalizado_em, CASE WHEN fechamento_lote_id IS NOT NULL OR status IN ('fechado', 'finalizado') THEN updated_at END),
  faturamento_saida_em = COALESCE(faturamento_saida_em, CASE WHEN fechamento_lote_id IS NOT NULL OR status IN ('fechado', 'finalizado') THEN updated_at END)
WHERE true;