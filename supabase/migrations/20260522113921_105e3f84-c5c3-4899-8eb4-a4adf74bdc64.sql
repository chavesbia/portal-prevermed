CREATE OR REPLACE FUNCTION public.dashboard_guias_agregado(
  _periodo_ini date DEFAULT NULL,
  _periodo_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := COALESCE(_periodo_ini, DATE '2026-01-01');
  v_fim date := COALESCE(_periodo_fim, CURRENT_DATE);
  v_last_import timestamptz;
  v_last_business_day date;
  v_result jsonb;
  v_totais jsonb;
  v_daily jsonb;
  v_prestador jsonb;
  v_empresa jsonb;
  v_exames jsonb;
  v_sla_mensal jsonb;
  v_ultimas int;
BEGIN
  -- Última importação
  SELECT imported_at INTO v_last_import
  FROM public.guia_imports
  ORDER BY imported_at DESC
  LIMIT 1;

  -- Último dia útil baseado na última importação (ou hoje)
  WITH ref AS (
    SELECT COALESCE(v_last_import::date, CURRENT_DATE) AS r
  ), candidates AS (
    SELECT (SELECT r FROM ref) - gs AS d
    FROM generate_series(1, 14) gs
  )
  SELECT d INTO v_last_business_day
  FROM candidates
  WHERE EXTRACT(ISODOW FROM d) < 6
    AND d NOT IN (SELECT data FROM public.feriados)
  ORDER BY d DESC
  LIMIT 1;

  -- CTE base com tudo derivado
  WITH base AS (
    SELECT
      g.id,
      g.guia_codigo,
      g.data_guia,
      g.data_agendamento,
      g.empresa_nome,
      g.prestador_nome,
      g.tipo_exame,
      g.atendido_texto,
      g.solicitante_nome,
      COALESCE(gg.compareceu_status::text,'NAO_INFORMADO') AS compareceu,
      COALESCE(gg.atendimento_lancado::text,'NAO_INFORMADO') AS atend_lancado,
      COALESCE(gg.aso_anexado::text,'NAO_INFORMADO') AS aso_anexado,
      COALESCE(gg.aguardando_aso::text,'NAO_INFORMADO') AS aguardando_aso,
      gg.sla_final,
      public.guias_sla_status(COALESCE(g.data_agendamento, g.data_guia), gg.atendimento_lancado::text, gg.sla_final) AS sla,
      public.guias_status_guia(
        COALESCE(gg.compareceu_status::text,'NAO_INFORMADO'),
        COALESCE(gg.atendimento_lancado::text,'NAO_INFORMADO'),
        COALESCE(gg.aso_anexado::text,'NAO_INFORMADO'),
        COALESCE(gg.aguardando_aso::text,'NAO_INFORMADO')
      ) AS status_guia,
      CASE WHEN g.solicitante_nome IS NOT NULL AND upper(g.solicitante_nome) LIKE '%EMPRESA:%' THEN 'CLIENTE' ELSE 'PREVERMED' END AS origem,
      CASE WHEN g.prestador_nome IS NULL OR btrim(g.prestador_nome) = '' THEN 'SEM PRESTADOR' ELSE 'COM PRESTADOR' END AS status_prest
    FROM public.guias g
    LEFT JOIN public.guia_gestao gg ON gg.guia_codigo = g.guia_codigo
    WHERE g.data_guia >= GREATEST(v_ini, DATE '2026-01-01')
      AND g.data_guia <= v_fim
      AND NOT EXISTS (
        SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL
      )
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'atrasadas', count(*) FILTER (WHERE sla='ATRASADO'),
    'em_atencao', count(*) FILTER (WHERE sla='ATENCAO'),
    'em_dia', count(*) FILTER (WHERE sla='EM_DIA'),
    'sem_prestador', count(*) FILTER (WHERE status_prest='SEM PRESTADOR'),
    'pendentes', count(*) FILTER (WHERE status_guia='PENDENTE'),
    'iniciadas', count(*) FILTER (WHERE status_guia='INICIADA'),
    'em_andamento', count(*) FILTER (WHERE status_guia='EM_ANDAMENTO'),
    'finalizadas', count(*) FILTER (WHERE status_guia='FINALIZADA'),
    'finalizadas_com_atraso', count(*) FILTER (WHERE status_guia='FINALIZADA' AND sla='ATRASADO'),
    'origem_cliente', count(*) FILTER (WHERE origem='CLIENTE'),
    'origem_prevermed', count(*) FILTER (WHERE origem='PREVERMED'),
    'compareceram', count(*) FILTER (WHERE compareceu='COMPARECEU'),
    'nao_compareceram', count(*) FILTER (WHERE compareceu='NAO_COMPARECEU')
  ) INTO v_totais
  FROM base;

  -- Últimas guias (último dia útil)
  SELECT count(*)::int INTO v_ultimas
  FROM public.guias g
  WHERE g.data_guia = v_last_business_day
    AND NOT EXISTS (
      SELECT 1 FROM public.prestadores_bloqueados pb
      WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
        AND g.prestador_nome IS NOT NULL
    );

  -- Série diária do período
  WITH days AS (
    SELECT generate_series(v_ini, v_fim, interval '1 day')::date AS d
  ), counts AS (
    SELECT g.data_guia AS d, count(*)::int AS c
    FROM public.guias g
    WHERE g.data_guia BETWEEN v_ini AND v_fim
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (
        SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL
      )
    GROUP BY g.data_guia
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(days.d,'YYYY-MM-DD'), 'count', COALESCE(counts.c,0)) ORDER BY days.d), '[]'::jsonb)
  INTO v_daily
  FROM days LEFT JOIN counts ON counts.d = days.d;

  -- Top prestadores em atraso
  WITH base AS (
    SELECT
      COALESCE(NULLIF(btrim(g.prestador_nome),''), 'Sem prestador') AS name,
      public.guias_sla_status(COALESCE(g.data_agendamento, g.data_guia), gg.atendimento_lancado::text, gg.sla_final) AS sla
    FROM public.guias g
    LEFT JOIN public.guia_gestao gg ON gg.guia_codigo = g.guia_codigo
    WHERE g.data_guia BETWEEN v_ini AND v_fim
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (
        SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL
      )
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
  INTO v_prestador
  FROM (
    SELECT name, count(*)::int c FROM base WHERE sla='ATRASADO' GROUP BY name ORDER BY c DESC LIMIT 8
  ) t;

  -- Top empresas
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
  INTO v_empresa
  FROM (
    SELECT COALESCE(NULLIF(btrim(g.empresa_nome),''), 'Sem empresa') AS name, count(*)::int c
    FROM public.guias g
    WHERE g.data_guia BETWEEN v_ini AND v_fim
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (
        SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL
      )
    GROUP BY 1 ORDER BY c DESC LIMIT 8
  ) t;

  -- Top exames
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
  INTO v_exames
  FROM (
    SELECT COALESCE(NULLIF(btrim(ge.exame_nome),''), 'Sem nome') AS name, count(*)::int c
    FROM public.guia_exames ge
    JOIN public.guias g ON g.guia_codigo = ge.guia_codigo
    WHERE g.data_guia BETWEEN v_ini AND v_fim
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (
        SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL
      )
    GROUP BY 1 ORDER BY c DESC LIMIT 8
  ) t;

  -- Comparativo mensal de SLA — últimos 6 meses (independe do período)
  WITH months AS (
    SELECT date_trunc('month', CURRENT_DATE) - (gs || ' months')::interval AS m
    FROM generate_series(0, 5) gs
  ), base AS (
    SELECT
      date_trunc('month', g.data_guia)::date AS mes,
      public.guias_sla_status(COALESCE(g.data_agendamento, g.data_guia), gg.atendimento_lancado::text, gg.sla_final) AS sla
    FROM public.guias g
    LEFT JOIN public.guia_gestao gg ON gg.guia_codigo = g.guia_codigo
    WHERE g.data_guia >= (date_trunc('month', CURRENT_DATE) - interval '5 months')::date
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (
        SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL
      )
  ), agg AS (
    SELECT mes,
      count(*) FILTER (WHERE sla='EM_DIA')::int AS em_dia,
      count(*) FILTER (WHERE sla='ATENCAO')::int AS atencao,
      count(*) FILTER (WHERE sla='ATRASADO')::int AS atrasado,
      count(*)::int AS total
    FROM base GROUP BY mes
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes', to_char(months.m, 'YYYY-MM'),
    'mes_label', to_char(months.m, 'Mon/YY'),
    'em_dia', COALESCE(agg.em_dia, 0),
    'atencao', COALESCE(agg.atencao, 0),
    'atrasado', COALESCE(agg.atrasado, 0),
    'total', COALESCE(agg.total, 0)
  ) ORDER BY months.m), '[]'::jsonb)
  INTO v_sla_mensal
  FROM months LEFT JOIN agg ON agg.mes = months.m::date;

  v_result := jsonb_build_object(
    'periodo_ini', to_char(v_ini, 'YYYY-MM-DD'),
    'periodo_fim', to_char(v_fim, 'YYYY-MM-DD'),
    'ultima_importacao', v_last_import,
    'ultimo_dia_util', to_char(v_last_business_day, 'YYYY-MM-DD'),
    'totais', v_totais || jsonb_build_object('ultimas', COALESCE(v_ultimas, 0)),
    'daily', v_daily,
    'prestador_atrasos', v_prestador,
    'empresas', v_empresa,
    'exames', v_exames,
    'sla_mensal', v_sla_mensal
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_guias_agregado(date, date) TO authenticated;