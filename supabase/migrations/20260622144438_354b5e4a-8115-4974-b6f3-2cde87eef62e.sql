
-- 1) Add incluido_no_ciclo
ALTER TABLE public.fb_colaboradores
  ADD COLUMN IF NOT EXISTS incluido_no_ciclo boolean NOT NULL DEFAULT false;

-- 2) Allow nome to be null (will be sourced from profile)
ALTER TABLE public.fb_colaboradores ALTER COLUMN nome DROP NOT NULL;

-- 3) Unique constraint on user_id (one feedback record per user)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fb_colaboradores_user_id_key') THEN
    ALTER TABLE public.fb_colaboradores ADD CONSTRAINT fb_colaboradores_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 4) Allow any authenticated user to read collaborators (so RH list works);
-- write actions remain RH-only via existing policies.
DROP POLICY IF EXISTS "fb_colab select" ON public.fb_colaboradores;
CREATE POLICY "fb_colab select" ON public.fb_colaboradores
  FOR SELECT TO authenticated USING (true);

-- 5) Rebuild view sourcing data from profiles
DROP VIEW IF EXISTS public.fb_v_status_colaborador;

CREATE VIEW public.fb_v_status_colaborador
WITH (security_invoker = true)
AS
SELECT
  COALESCE(c.id, p.user_id) AS colaborador_id,
  c.id AS fb_colaborador_id,
  p.user_id,
  COALESCE(NULLIF(btrim(c.nome), ''), p.full_name) AS nome,
  c.matricula,
  c.cpf,
  COALESCE(c.cargo, p.position) AS cargo,
  c.setor_id,
  s.nome AS setor_nome,
  c.gestor_id,
  p.unit,
  COALESCE(c.data_admissao, p.start_date) AS data_admissao,
  COALESCE(c.status::text,
    CASE WHEN p.status = 'active' THEN 'ativo' ELSE 'inativo' END
  )::public.fb_colaborador_status AS status,
  COALESCE(c.periodicidade_dias, 90) AS periodicidade_dias,
  COALESCE(c.incluido_no_ciclo, false) AS incluido_no_ciclo,
  ult.id AS ultima_avaliacao_id,
  ult.data_avaliacao AS ultimo_feedback,
  ult.data_proximo_feedback AS proximo_feedback,
  ult.pontuacao_total,
  ult.classificacao,
  CASE
    WHEN ult.data_proximo_feedback IS NULL THEN 'sem_feedback'
    WHEN ult.data_proximo_feedback < CURRENT_DATE THEN 'atrasado'
    WHEN ult.data_proximo_feedback <= (CURRENT_DATE + interval '15 days') THEN 'proximo'
    ELSE 'em_dia'
  END AS status_feedback,
  CASE
    WHEN ult.pontuacao_total IS NULL THEN 'baixo'::public.fb_risco
    WHEN ult.pontuacao_total < 24 THEN 'alto'::public.fb_risco
    WHEN ult.pontuacao_total BETWEEN 24 AND 28 THEN 'medio'::public.fb_risco
    ELSE 'baixo'::public.fb_risco
  END AS risco
FROM public.profiles p
LEFT JOIN public.fb_colaboradores c ON c.user_id = p.user_id
LEFT JOIN public.fb_setores s ON s.id = c.setor_id
LEFT JOIN LATERAL (
  SELECT a.* FROM public.fb_avaliacoes a
  WHERE a.colaborador_id = c.id AND a.concluida = true
  ORDER BY a.data_avaliacao DESC LIMIT 1
) ult ON true
WHERE p.status = 'active' OR c.id IS NOT NULL;

GRANT SELECT ON public.fb_v_status_colaborador TO authenticated;
