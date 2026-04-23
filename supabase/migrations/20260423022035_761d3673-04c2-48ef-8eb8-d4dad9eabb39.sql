CREATE OR REPLACE FUNCTION public.validate_aso_stage_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_stage text := public.aso_status_to_stage(OLD.status);
  new_stage text := public.aso_status_to_stage(NEW.status);
  effective_stage text := COALESCE(new_stage, old_stage);
  can_edit_recepcao boolean := public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/recepcao');
  can_approve_recepcao boolean := public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/liberacao-asos/recepcao');
  can_edit_enfermagem boolean := public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem');
  can_approve_enfermagem boolean := public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/liberacao-asos/enfermagem');
  can_edit_assinatura boolean := public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/assinatura');
  can_approve_assinatura boolean := public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/liberacao-asos/assinatura');
  can_edit_liberacao boolean := public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/liberacao');
  can_approve_liberacao boolean := public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/liberacao-asos/liberacao');
  can_edit_faturamento boolean := public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/faturamento');
  can_approve_faturamento boolean := public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/liberacao-asos/faturamento');
  changed_recepcao_fields boolean;
  changed_enfermagem_fields boolean;
  changed_assinatura_fields boolean;
  changed_liberacao_fields boolean;
  changed_faturamento_fields boolean;
  changed_stage_transition boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  changed_recepcao_fields := (
    NEW.tipo_prontuario IS DISTINCT FROM OLD.tipo_prontuario
    OR NEW.base_socnet IS DISTINCT FROM OLD.base_socnet
    OR NEW.ficha_clinica_ok IS DISTINCT FROM OLD.ficha_clinica_ok
    OR NEW.vias_aso_ok IS DISTINCT FROM OLD.vias_aso_ok
    OR NEW.possui_exame_complementar IS DISTINCT FROM OLD.possui_exame_complementar
    OR NEW.observacoes_recepcao IS DISTINCT FROM OLD.observacoes_recepcao
    OR NEW.data_assinatura IS DISTINCT FROM OLD.data_assinatura
  );

  changed_enfermagem_fields := false;

  changed_assinatura_fields := (
    NEW.aso_assinado IS DISTINCT FROM OLD.aso_assinado
    OR NEW.data_assinatura IS DISTINCT FROM OLD.data_assinatura
    OR NEW.observacoes_assinatura IS DISTINCT FROM OLD.observacoes_assinatura
  );

  changed_liberacao_fields := (
    NEW.escaneado IS DISTINCT FROM OLD.escaneado
    OR NEW.renomeado IS DISTINCT FROM OLD.renomeado
    OR NEW.salvo_socged IS DISTINCT FROM OLD.salvo_socged
    OR NEW.email_enviado IS DISTINCT FROM OLD.email_enviado
    OR NEW.conferencia_final_ok IS DISTINCT FROM OLD.conferencia_final_ok
    OR NEW.observacoes_escaneamento IS DISTINCT FROM OLD.observacoes_escaneamento
  );

  changed_faturamento_fields := (
    NEW.observacoes_faturamento IS DISTINCT FROM OLD.observacoes_faturamento
    OR NEW.fechamento_lote_id IS DISTINCT FROM OLD.fechamento_lote_id
    OR (
      OLD.status IS DISTINCT FROM NEW.status
      AND (
        OLD.status IN ('liberado', 'liberado_faturamento', 'fechado', 'finalizado')
        OR NEW.status IN ('liberado', 'liberado_faturamento', 'fechado', 'finalizado')
      )
    )
  );

  changed_stage_transition := (
    OLD.status IS DISTINCT FROM NEW.status
    OR NEW.setor_responsavel IS DISTINCT FROM OLD.setor_responsavel
  );

  IF effective_stage = 'recepcao' AND changed_recepcao_fields AND NOT can_edit_recepcao THEN
    RAISE EXCEPTION 'Você não tem permissão para editar a etapa Recepção.';
  END IF;

  IF effective_stage = 'exames' AND changed_enfermagem_fields AND NOT can_edit_enfermagem THEN
    RAISE EXCEPTION 'Você não tem permissão para editar a etapa Enfermagem.';
  END IF;

  IF (old_stage = 'assinatura' OR new_stage = 'assinatura') AND changed_assinatura_fields AND NOT can_edit_assinatura THEN
    RAISE EXCEPTION 'Você não tem permissão para editar a etapa Assinatura.';
  END IF;

  IF (old_stage = 'liberacao' OR new_stage = 'liberacao') AND changed_liberacao_fields AND NOT can_edit_liberacao THEN
    RAISE EXCEPTION 'Você não tem permissão para editar a etapa Liberação.';
  END IF;

  IF (old_stage = 'faturamento' OR new_stage = 'faturamento') AND changed_faturamento_fields AND NOT can_edit_faturamento THEN
    RAISE EXCEPTION 'Você não tem permissão para editar a etapa Faturamento.';
  END IF;

  IF changed_stage_transition THEN
    IF old_stage = 'recepcao' AND new_stage IS DISTINCT FROM old_stage AND NOT can_approve_recepcao THEN
      RAISE EXCEPTION 'Você não tem permissão para avançar a etapa Recepção.';
    END IF;

    IF old_stage = 'exames' AND new_stage IS DISTINCT FROM old_stage AND NOT can_approve_enfermagem THEN
      RAISE EXCEPTION 'Você não tem permissão para avançar a etapa Enfermagem.';
    END IF;

    IF old_stage = 'assinatura' AND new_stage IS DISTINCT FROM old_stage AND NOT can_approve_assinatura THEN
      RAISE EXCEPTION 'Você não tem permissão para avançar a etapa Assinatura.';
    END IF;

    IF old_stage = 'liberacao' AND new_stage IS DISTINCT FROM old_stage AND NOT can_approve_liberacao THEN
      RAISE EXCEPTION 'Você não tem permissão para avançar a etapa Liberação.';
    END IF;

    IF old_stage = 'faturamento' AND new_stage IS DISTINCT FROM old_stage AND NOT can_approve_faturamento THEN
      RAISE EXCEPTION 'Você não tem permissão para avançar a etapa Faturamento.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_aso_stage_permissions_trigger ON public.aso_atendimentos;
CREATE TRIGGER validate_aso_stage_permissions_trigger
BEFORE UPDATE ON public.aso_atendimentos
FOR EACH ROW
EXECUTE FUNCTION public.validate_aso_stage_permissions();