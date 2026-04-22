CREATE OR REPLACE FUNCTION public.can_approve_module_route(_user_id uuid, _route text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.get_user_accessible_modules(_user_id) gum
    WHERE gum.module_route = _route
      AND gum.can_approve = true
  )
$$;

CREATE OR REPLACE FUNCTION public.validate_aso_assinatura_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_edit_assinatura boolean := public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/assinatura');
  can_advance_assinatura boolean := public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/liberacao-asos/assinatura');
  changed_signature_fields boolean := false;
  changed_stage_transition boolean := false;
BEGIN
  changed_signature_fields := (
    NEW.aso_assinado IS DISTINCT FROM OLD.aso_assinado
    OR NEW.data_assinatura IS DISTINCT FROM OLD.data_assinatura
    OR NEW.observacoes_assinatura IS DISTINCT FROM OLD.observacoes_assinatura
  );

  changed_stage_transition := (
    OLD.status = 'pronto_assinatura_medica'
    AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.setor_responsavel IS DISTINCT FROM OLD.setor_responsavel
    )
  );

  IF (OLD.status = 'pronto_assinatura_medica' OR NEW.status = 'pronto_assinatura_medica') AND changed_signature_fields AND NOT can_edit_assinatura THEN
    RAISE EXCEPTION 'Você não tem permissão para editar a etapa Assinatura.';
  END IF;

  IF changed_stage_transition AND NOT can_advance_assinatura THEN
    RAISE EXCEPTION 'Você não tem permissão para avançar a etapa Assinatura.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_aso_assinatura_permissions_trigger ON public.aso_atendimentos;

CREATE TRIGGER validate_aso_assinatura_permissions_trigger
BEFORE UPDATE ON public.aso_atendimentos
FOR EACH ROW
EXECUTE FUNCTION public.validate_aso_assinatura_permissions();