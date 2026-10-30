ALTER TABLE public.soc_exames_pendentes
  ADD COLUMN IF NOT EXISTS nao_compareceu_em timestamptz,
  ADD COLUMN IF NOT EXISTS nao_compareceu_por uuid,
  ADD COLUMN IF NOT EXISTS nao_compareceu_obs text;

REVOKE UPDATE (nao_compareceu_em, nao_compareceu_por, nao_compareceu_obs) ON public.soc_exames_pendentes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.exames_pendentes_nao_compareceu(_sequencial text, _obs text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/exames-pendentes')) THEN
    PERFORM public.log_unauthorized_access('exames_pendentes_nao_compareceu', 'rpc', 'UPDATE', jsonb_build_object('ficha', _sequencial));
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF coalesce(trim(_obs), '') = '' THEN RAISE EXCEPTION 'Observação obrigatória'; END IF;
  UPDATE public.soc_exames_pendentes
     SET nao_compareceu_em = now(), nao_compareceu_por = auth.uid(), nao_compareceu_obs = left(trim(_obs), 1000)
   WHERE sequencial_ficha = _sequencial AND nao_compareceu_em IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.audit_log(user_id, action_type, object_type, details)
  VALUES (auth.uid(), 'exame_pendente_nao_compareceu', 'soc_exames_pendentes', jsonb_build_object('sequencial_ficha', _sequencial, 'observacao', left(trim(_obs),1000), 'exames', n));
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.exames_pendentes_nao_compareceu(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.exames_pendentes_nao_compareceu(text, text) TO authenticated;