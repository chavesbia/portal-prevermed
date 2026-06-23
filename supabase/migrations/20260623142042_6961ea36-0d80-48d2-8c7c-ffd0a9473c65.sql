-- 1) Patch listar_guias e dashboard_guias_agregado: trocar COALESCE(g.data_agendamento, g.data_guia) por g.data_agendamento
DO $mig$
DECLARE
  v_def text;
BEGIN
  FOR v_def IN
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('listar_guias','dashboard_guias_agregado')
  LOOP
    v_def := regexp_replace(
      v_def,
      'COALESCE\s*\(\s*g\.data_agendamento\s*,\s*g\.data_guia\s*\)',
      'g.data_agendamento',
      'gi'
    );
    EXECUTE v_def;
  END LOOP;
END
$mig$;

-- 2) Recalcular sla_final para guias finalizadas que possuem data_agendamento,
--    usando a data em que o atendimento foi lançado (guia_gestao.updated_at) como ponto final.
WITH alvo AS (
  SELECT gg.guia_codigo,
         g.data_agendamento,
         gg.updated_at::date AS data_lancamento
  FROM public.guia_gestao gg
  JOIN public.guias g ON g.guia_codigo = gg.guia_codigo
  WHERE gg.sla_final IS NOT NULL
    AND g.data_agendamento IS NOT NULL
), recalc AS (
  SELECT guia_codigo,
         CASE
           WHEN public.guias_business_days(data_agendamento, data_lancamento) >= 5 THEN 'ATRASADO'
           WHEN public.guias_business_days(data_agendamento, data_lancamento) >= 4 THEN 'ATENCAO'
           ELSE 'EM_DIA'
         END AS novo_sla
  FROM alvo
)
UPDATE public.guia_gestao gg
SET sla_final = r.novo_sla
FROM recalc r
WHERE gg.guia_codigo = r.guia_codigo
  AND gg.sla_final IS DISTINCT FROM r.novo_sla;
