
-- 1) Hierarquia completa: walk up via profiles.direct_leader_id / direct_manager_id
CREATE OR REPLACE FUNCTION public.fb_is_gestor_de(_user_id uuid, _colaborador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE base AS (
    SELECT c.user_id AS uid
    FROM public.fb_colaboradores c
    WHERE c.id = _colaborador_id AND c.user_id IS NOT NULL
  ),
  chain AS (
    SELECT p.user_id, p.direct_leader_id, p.direct_manager_id, 0 AS depth
    FROM public.profiles p
    JOIN base b ON b.uid = p.user_id
    UNION ALL
    SELECT p.user_id, p.direct_leader_id, p.direct_manager_id, c.depth + 1
    FROM public.profiles p
    JOIN chain c
      ON p.user_id = c.direct_leader_id
      OR p.user_id = c.direct_manager_id
    WHERE c.depth < 20
  )
  SELECT EXISTS (
    SELECT 1 FROM chain
    WHERE direct_leader_id = _user_id
       OR direct_manager_id = _user_id
  );
$$;

-- 2) View: setor da lotação principal + líder/gestor diretos
DROP VIEW IF EXISTS public.fb_v_status_colaborador;

CREATE VIEW public.fb_v_status_colaborador
WITH (security_invoker=on) AS
WITH lot AS (
  SELECT DISTINCT ON (ud.user_id)
    ud.user_id,
    ud.department_id,
    d.name AS department_name
  FROM public.user_departments ud
  JOIN public.departments d ON d.id = ud.department_id
  ORDER BY ud.user_id, ud.is_lotacao DESC NULLS LAST, ud.is_primary DESC NULLS LAST, ud.created_at ASC
)
SELECT
  COALESCE(c.id, p.user_id) AS colaborador_id,
  c.id AS fb_colaborador_id,
  p.user_id,
  COALESCE(NULLIF(btrim(c.nome), ''), p.full_name) AS nome,
  c.matricula,
  c.cpf,
  COALESCE(c.cargo, p."position") AS cargo,
  lot.department_id AS setor_id,
  lot.department_name AS setor_nome,
  p.direct_leader_id AS lider_id,
  lp.full_name AS lider_nome,
  p.direct_manager_id AS gestor_id,
  mp.full_name AS gestor_nome,
  p.unit,
  COALESCE(c.data_admissao, p.start_date) AS data_admissao,
  COALESCE(
    c.status::text,
    CASE WHEN p.status = 'active'::user_status THEN 'ativo' ELSE 'inativo' END
  )::fb_colaborador_status AS status,
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
    WHEN ult.data_proximo_feedback <= (CURRENT_DATE + INTERVAL '15 days') THEN 'proximo'
    ELSE 'em_dia'
  END AS status_feedback,
  CASE
    WHEN ult.pontuacao_total IS NULL THEN 'baixo'::fb_risco
    WHEN ult.pontuacao_total < 24 THEN 'alto'::fb_risco
    WHEN ult.pontuacao_total BETWEEN 24 AND 28 THEN 'medio'::fb_risco
    ELSE 'baixo'::fb_risco
  END AS risco
FROM public.profiles p
LEFT JOIN public.fb_colaboradores c ON c.user_id = p.user_id
LEFT JOIN lot ON lot.user_id = p.user_id
LEFT JOIN public.profiles lp ON lp.user_id = p.direct_leader_id
LEFT JOIN public.profiles mp ON mp.user_id = p.direct_manager_id
LEFT JOIN LATERAL (
  SELECT a.*
  FROM public.fb_avaliacoes a
  WHERE a.colaborador_id = c.id AND a.concluida = true
  ORDER BY a.data_avaliacao DESC
  LIMIT 1
) ult ON true
WHERE p.status = 'active'::user_status OR c.id IS NOT NULL;

GRANT SELECT ON public.fb_v_status_colaborador TO authenticated;
