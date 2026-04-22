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
  ELSIF OLD.fechamento_lote_id IS NOT NULL AND NEW.fechamento_lote_id IS NULL THEN
    NEW.finalizado_em := NULL;
    IF new_stage = 'faturamento' THEN
      NEW.faturamento_saida_em := NULL;
      NEW.faturamento_entrada_em := COALESCE(OLD.faturamento_entrada_em, NEW.faturamento_entrada_em, transition_time);
    END IF;
  ELSIF OLD.status = ANY (ARRAY['fechado'::public.aso_status, 'finalizado'::public.aso_status])
    AND NEW.status <> ALL (ARRAY['fechado'::public.aso_status, 'finalizado'::public.aso_status]) THEN
    NEW.finalizado_em := NULL;
    IF new_stage = 'faturamento' THEN
      NEW.faturamento_saida_em := NULL;
      NEW.faturamento_entrada_em := COALESCE(OLD.faturamento_entrada_em, NEW.faturamento_entrada_em, transition_time);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;