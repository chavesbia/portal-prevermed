ALTER TABLE public.soc_agendamentos ADD COLUMN kit_impresso_em timestamptz, ADD COLUMN kit_impresso_por uuid;
CREATE OR REPLACE FUNCTION public.agenda_marcar_kit_impresso(_agendamento_id uuid, _impresso boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE anterior timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/agendamentos')) THEN RAISE EXCEPTION 'Sem permissão para controlar impressão do kit' USING ERRCODE='42501'; END IF;
 SELECT kit_impresso_em INTO anterior FROM public.soc_agendamentos WHERE id = _agendamento_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
 IF _impresso AND NOT EXISTS (SELECT 1 FROM public.soc_agendamento_anexos WHERE agendamento_id = _agendamento_id AND tipo_documento ~* '(guia|kit)') AND NOT EXISTS (SELECT 1 FROM public.soc_agendamentos WHERE id=_agendamento_id AND guia_path IS NOT NULL) THEN RAISE EXCEPTION 'Nenhum kit ou guia enviado'; END IF;
 IF (anterior IS NOT NULL) = _impresso THEN RETURN; END IF;
 UPDATE public.soc_agendamentos SET kit_impresso_em=CASE WHEN _impresso THEN now() ELSE NULL END, kit_impresso_por=CASE WHEN _impresso THEN auth.uid() ELSE NULL END WHERE id=_agendamento_id;
 INSERT INTO public.audit_log(user_id,action_type,object_type,object_id,details) VALUES(auth.uid(),'UPDATE','soc_agendamentos',_agendamento_id,jsonb_build_object('acao','kit_impresso','impresso',_impresso,'anterior',anterior));
END; $$;
REVOKE ALL ON FUNCTION public.agenda_marcar_kit_impresso(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_marcar_kit_impresso(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.agenda_proteger_impressao() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF current_user IN ('authenticated','anon','authenticator') AND (NEW.kit_impresso_em IS DISTINCT FROM OLD.kit_impresso_em OR NEW.kit_impresso_por IS DISTINCT FROM OLD.kit_impresso_por) THEN RAISE EXCEPTION 'Use o controle autorizado de impressão'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER agenda_proteger_impressao BEFORE UPDATE ON public.soc_agendamentos FOR EACH ROW EXECUTE FUNCTION public.agenda_proteger_impressao();