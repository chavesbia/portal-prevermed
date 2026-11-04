CREATE TABLE public.soc_exames_pendentes_motivos (
  sequencial_ficha text PRIMARY KEY,
  motivo text NOT NULL CHECK (motivo IN ('aguardando_laudo','aguardando_empresa','aguardando_colaborador','em_analise_medica','outro')),
  observacao text,
  atualizado_por uuid NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.soc_exames_pendentes_motivos TO authenticated;
GRANT ALL ON public.soc_exames_pendentes_motivos TO service_role;
ALTER TABLE public.soc_exames_pendentes_motivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "motivos leitura" ON public.soc_exames_pendentes_motivos FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/exames-pendentes'));

CREATE OR REPLACE FUNCTION public.exames_pendentes_definir_motivo(_sequencial text, _motivo text, _obs text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/exames-pendentes')) THEN
    PERFORM public.log_unauthorized_access('exames_pendentes_definir_motivo', 'rpc', 'UPDATE', jsonb_build_object('ficha', _sequencial));
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _motivo = 'outro' AND coalesce(trim(_obs), '') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória para Outro'; END IF;
  INSERT INTO public.soc_exames_pendentes_motivos(sequencial_ficha, motivo, observacao, atualizado_por, atualizado_em)
  VALUES (_sequencial, _motivo, nullif(left(trim(coalesce(_obs,'')),1000),''), auth.uid(), now())
  ON CONFLICT (sequencial_ficha) DO UPDATE SET motivo = excluded.motivo, observacao = excluded.observacao, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  INSERT INTO public.audit_log(user_id, action_type, object_type, details)
  VALUES (auth.uid(), 'exame_pendente_motivo', 'soc_exames_pendentes', jsonb_build_object('sequencial_ficha', _sequencial, 'motivo', _motivo, 'observacao', left(trim(coalesce(_obs,'')),1000)));
END $$;
REVOKE ALL ON FUNCTION public.exames_pendentes_definir_motivo(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.exames_pendentes_definir_motivo(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.exames_pendentes_reabrir(_sequencial text, _obs text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_adm_master() OR public.can_approve_module_route(auth.uid(), '/exames-pendentes')) THEN
    PERFORM public.log_unauthorized_access('exames_pendentes_reabrir', 'rpc', 'UPDATE', jsonb_build_object('ficha', _sequencial));
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF coalesce(trim(_obs), '') = '' THEN RAISE EXCEPTION 'Motivo da reabertura obrigatório'; END IF;
  UPDATE public.soc_exames_pendentes SET nao_compareceu_em = NULL, nao_compareceu_por = NULL, nao_compareceu_obs = NULL
   WHERE sequencial_ficha = _sequencial AND nao_compareceu_em IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.audit_log(user_id, action_type, object_type, details)
  VALUES (auth.uid(), 'exame_pendente_reaberto', 'soc_exames_pendentes', jsonb_build_object('sequencial_ficha', _sequencial, 'observacao', left(trim(_obs),1000), 'exames', n));
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.exames_pendentes_reabrir(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.exames_pendentes_reabrir(text, text) TO authenticated;