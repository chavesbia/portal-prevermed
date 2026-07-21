
CREATE OR REPLACE FUNCTION public.fb_is_rh(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'adm_master')
      OR public.can_edit_module_route(_user_id, '/gestao-feedback/configuracoes')
      OR EXISTS (
        SELECT 1
        FROM public.user_departments ud
        JOIN public.departments d ON d.id = ud.department_id
        WHERE ud.user_id = _user_id
          AND lower(d.name) LIKE '%recursos humanos%'
      );
$$;

ALTER TABLE public.fb_pdi
  ADD COLUMN IF NOT EXISTS aguardando_validacao boolean NOT NULL DEFAULT false;
ALTER TABLE public.fb_feedforward
  ADD COLUMN IF NOT EXISTS aguardando_validacao boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "fb_pdi self select" ON public.fb_pdi;
CREATE POLICY "fb_pdi self select" ON public.fb_pdi
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.fb_avaliacoes a
  JOIN public.fb_colaboradores c ON c.id = a.colaborador_id
  WHERE a.id = fb_pdi.avaliacao_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "fb_ff self select" ON public.fb_feedforward;
CREATE POLICY "fb_ff self select" ON public.fb_feedforward
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.fb_avaliacoes a
  JOIN public.fb_colaboradores c ON c.id = a.colaborador_id
  WHERE a.id = fb_feedforward.avaliacao_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "fb_notas self select" ON public.fb_avaliacao_notas;
CREATE POLICY "fb_notas self select" ON public.fb_avaliacao_notas
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.fb_avaliacoes a
  JOIN public.fb_colaboradores c ON c.id = a.colaborador_id
  WHERE a.id = fb_avaliacao_notas.avaliacao_id AND c.user_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.fb_solicitar_validacao_acao(
  _tabela text,
  _id uuid,
  _evidencia text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_aval uuid;
BEGIN
  IF _tabela NOT IN ('fb_pdi','fb_feedforward') THEN
    RAISE EXCEPTION 'Tabela inválida';
  END IF;

  IF _tabela = 'fb_pdi' THEN
    SELECT p.avaliacao_id INTO v_aval FROM public.fb_pdi p WHERE p.id = _id;
  ELSE
    SELECT f.avaliacao_id INTO v_aval FROM public.fb_feedforward f WHERE f.id = _id;
  END IF;

  IF v_aval IS NULL THEN RAISE EXCEPTION 'Ação não encontrada'; END IF;

  SELECT c.user_id INTO v_owner
  FROM public.fb_avaliacoes a
  JOIN public.fb_colaboradores c ON c.id = a.colaborador_id
  WHERE a.id = v_aval;

  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Somente o próprio colaborador pode solicitar validação.';
  END IF;

  IF _tabela = 'fb_pdi' THEN
    UPDATE public.fb_pdi
       SET aguardando_validacao = true,
           evidencia = COALESCE(_evidencia, evidencia),
           updated_at = now()
     WHERE id = _id;
  ELSE
    UPDATE public.fb_feedforward
       SET aguardando_validacao = true,
           updated_at = now()
     WHERE id = _id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fb_solicitar_validacao_acao(text, uuid, text) TO authenticated;
