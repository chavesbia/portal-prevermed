-- 1) Backfill: normalizar nomes existentes para CAIXA ALTA (sem espaços duplicados)
UPDATE public.guias SET
  prestador_nome = upper(regexp_replace(btrim(prestador_nome), '\s+', ' ', 'g'))
WHERE prestador_nome IS NOT NULL
  AND prestador_nome <> upper(regexp_replace(btrim(prestador_nome), '\s+', ' ', 'g'));

UPDATE public.guias SET
  empresa_nome = upper(regexp_replace(btrim(empresa_nome), '\s+', ' ', 'g'))
WHERE empresa_nome IS NOT NULL
  AND empresa_nome <> upper(regexp_replace(btrim(empresa_nome), '\s+', ' ', 'g'));

UPDATE public.guias SET
  funcionario_nome = upper(regexp_replace(btrim(funcionario_nome), '\s+', ' ', 'g'))
WHERE funcionario_nome IS NOT NULL
  AND funcionario_nome <> upper(regexp_replace(btrim(funcionario_nome), '\s+', ' ', 'g'));

UPDATE public.guias SET
  unidade_nome = upper(regexp_replace(btrim(unidade_nome), '\s+', ' ', 'g'))
WHERE unidade_nome IS NOT NULL
  AND unidade_nome <> upper(regexp_replace(btrim(unidade_nome), '\s+', ' ', 'g'));

UPDATE public.guias SET
  medico_nome = upper(regexp_replace(btrim(medico_nome), '\s+', ' ', 'g'))
WHERE medico_nome IS NOT NULL
  AND medico_nome <> upper(regexp_replace(btrim(medico_nome), '\s+', ' ', 'g'));

UPDATE public.guias SET
  solicitante_nome = upper(regexp_replace(btrim(solicitante_nome), '\s+', ' ', 'g'))
WHERE solicitante_nome IS NOT NULL
  AND solicitante_nome <> upper(regexp_replace(btrim(solicitante_nome), '\s+', ' ', 'g'));

UPDATE public.guias SET
  tipo_exame = upper(regexp_replace(btrim(tipo_exame), '\s+', ' ', 'g'))
WHERE tipo_exame IS NOT NULL
  AND tipo_exame <> upper(regexp_replace(btrim(tipo_exame), '\s+', ' ', 'g'));

UPDATE public.guias SET
  situacao = upper(regexp_replace(btrim(situacao), '\s+', ' ', 'g'))
WHERE situacao IS NOT NULL
  AND situacao <> upper(regexp_replace(btrim(situacao), '\s+', ' ', 'g'));

UPDATE public.guia_exames SET
  exame_nome = upper(regexp_replace(btrim(exame_nome), '\s+', ' ', 'g'))
WHERE exame_nome IS NOT NULL
  AND exame_nome <> upper(regexp_replace(btrim(exame_nome), '\s+', ' ', 'g'));

-- 2) Recriar RPC do dashboard usando upper(btrim(...)) nos agrupamentos por nome
CREATE OR REPLACE FUNCTION public.dashboard_guias_agregado(_periodo_ini date DEFAULT NULL::date, _periodo_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_comp_empresa jsonb;
  v_comp_prestador jsonb;
  v_variacao jsonb;
  v_dias int;
  v_prev_ini date;
  v_prev_fim date;
  v_cur_total int; v_cur_atr int; v_cur_fin int;
  v_prev_total int; v_prev_atr int; v_prev_fin int;
BEGIN
  SELECT imported_at INTO v_last_import FROM public.guia_imports ORDER BY imported_at DESC LIMIT 1;

  WITH ref AS (SELECT COALESCE(v_last_import::date, CURRENT_DATE) AS r),
  candidates AS (SELECT (SELECT r FROM ref) - gs AS d FROM generate_series(1, 14) gs)
  SELECT d INTO v_last_business_day FROM candidates
  WHERE EXTRACT(ISODOW FROM d) < 6 AND d NOT IN (SELECT data FROM public.feriados)
  ORDER BY d DESC LIMIT 1;

  WITH base AS (
    SELECT
      g.data_guia, g.data_agendamento, g.empresa_nome, g.prestador_nome, g.solicitante_nome,
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
    WHERE g.data_guia >= GREATEST(v_ini, DATE '2026-01-01') AND g.data_guia <= v_fim
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
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
  ) INTO v_totais FROM base;

  SELECT count(*)::int INTO v_ultimas FROM public.guias g
  WHERE g.data_guia = v_last_business_day
    AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
      WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
        AND g.prestador_nome IS NOT NULL);

  WITH days AS (SELECT generate_series(v_ini, v_fim, interval '1 day')::date AS d),
  counts AS (
    SELECT g.data_guia AS d, count(*)::int AS c FROM public.guias g
    WHERE g.data_guia BETWEEN v_ini AND v_fim AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
    GROUP BY g.data_guia
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(days.d,'YYYY-MM-DD'), 'count', COALESCE(counts.c,0)) ORDER BY days.d), '[]'::jsonb)
  INTO v_daily FROM days LEFT JOIN counts ON counts.d = days.d;

  -- Top prestadores com atrasos (normalizado)
  WITH base AS (
    SELECT
      COALESCE(NULLIF(upper(regexp_replace(btrim(g.prestador_nome), '\s+', ' ', 'g')),''), 'SEM PRESTADOR') AS name,
      public.guias_sla_status(COALESCE(g.data_agendamento, g.data_guia), gg.atendimento_lancado::text, gg.sla_final) AS sla
    FROM public.guias g LEFT JOIN public.guia_gestao gg ON gg.guia_codigo = g.guia_codigo
    WHERE g.data_guia BETWEEN v_ini AND v_fim AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
  INTO v_prestador FROM (SELECT name, count(*)::int c FROM base WHERE sla='ATRASADO' GROUP BY name ORDER BY c DESC LIMIT 8) t;

  -- Top empresas (normalizado)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
  INTO v_empresa FROM (
    SELECT COALESCE(NULLIF(upper(regexp_replace(btrim(g.empresa_nome), '\s+', ' ', 'g')),''), 'SEM EMPRESA') AS name, count(*)::int c
    FROM public.guias g
    WHERE g.data_guia BETWEEN v_ini AND v_fim AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
    GROUP BY 1 ORDER BY c DESC LIMIT 8
  ) t;

  -- Top exames (normalizado)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
  INTO v_exames FROM (
    SELECT COALESCE(NULLIF(upper(regexp_replace(btrim(ge.exame_nome), '\s+', ' ', 'g')),''), 'SEM NOME') AS name, count(*)::int c
    FROM public.guia_exames ge JOIN public.guias g ON g.guia_codigo = ge.guia_codigo
    WHERE g.data_guia BETWEEN v_ini AND v_fim AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
    GROUP BY 1 ORDER BY c DESC LIMIT 8
  ) t;

  WITH months AS (
    SELECT date_trunc('month', CURRENT_DATE) - (gs || ' months')::interval AS m
    FROM generate_series(0, 5) gs
  ), base AS (
    SELECT date_trunc('month', g.data_guia)::date AS mes,
      public.guias_sla_status(COALESCE(g.data_agendamento, g.data_guia), gg.atendimento_lancado::text, gg.sla_final) AS sla
    FROM public.guias g LEFT JOIN public.guia_gestao gg ON gg.guia_codigo = g.guia_codigo
    WHERE g.data_guia >= (date_trunc('month', CURRENT_DATE) - interval '5 months')::date
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
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
  INTO v_sla_mensal FROM months LEFT JOIN agg ON agg.mes = months.m::date;

  -- Comparativo mensal por empresa (Top 5, últimos 6 meses) - normalizado
  WITH months AS (
    SELECT date_trunc('month', CURRENT_DATE) - (gs || ' months')::interval AS m
    FROM generate_series(0, 5) gs
  ), base AS (
    SELECT date_trunc('month', g.data_guia)::date AS mes,
      COALESCE(NULLIF(upper(regexp_replace(btrim(g.empresa_nome), '\s+', ' ', 'g')),''), 'SEM EMPRESA') AS name
    FROM public.guias g
    WHERE g.data_guia >= (date_trunc('month', CURRENT_DATE) - interval '5 months')::date
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
  ), top_names AS (
    SELECT name FROM base GROUP BY name ORDER BY count(*) DESC LIMIT 5
  ), agg AS (
    SELECT mes, name, count(*)::int AS c FROM base WHERE name IN (SELECT name FROM top_names) GROUP BY mes, name
  )
  SELECT jsonb_build_object(
    'meses', COALESCE((SELECT jsonb_agg(jsonb_build_object('mes', to_char(m,'YYYY-MM'),'mes_label', to_char(m,'Mon/YY')) ORDER BY m) FROM months), '[]'::jsonb),
    'series', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', t.name,
        'pontos', (
          SELECT jsonb_agg(jsonb_build_object('mes', to_char(months.m,'YYYY-MM'), 'count', COALESCE(a.c, 0)) ORDER BY months.m)
          FROM months LEFT JOIN agg a ON a.mes = months.m::date AND a.name = t.name
        )
      ))
      FROM top_names t
    ), '[]'::jsonb)
  ) INTO v_comp_empresa;

  -- Comparativo mensal por prestador (Top 5, últimos 6 meses) - normalizado
  WITH months AS (
    SELECT date_trunc('month', CURRENT_DATE) - (gs || ' months')::interval AS m
    FROM generate_series(0, 5) gs
  ), base AS (
    SELECT date_trunc('month', g.data_guia)::date AS mes,
      COALESCE(NULLIF(upper(regexp_replace(btrim(g.prestador_nome), '\s+', ' ', 'g')),''), 'SEM PRESTADOR') AS name
    FROM public.guias g
    WHERE g.data_guia >= (date_trunc('month', CURRENT_DATE) - interval '5 months')::date
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
  ), top_names AS (
    SELECT name FROM base GROUP BY name ORDER BY count(*) DESC LIMIT 5
  ), agg AS (
    SELECT mes, name, count(*)::int AS c FROM base WHERE name IN (SELECT name FROM top_names) GROUP BY mes, name
  )
  SELECT jsonb_build_object(
    'meses', COALESCE((SELECT jsonb_agg(jsonb_build_object('mes', to_char(m,'YYYY-MM'),'mes_label', to_char(m,'Mon/YY')) ORDER BY m) FROM months), '[]'::jsonb),
    'series', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', t.name,
        'pontos', (
          SELECT jsonb_agg(jsonb_build_object('mes', to_char(months.m,'YYYY-MM'), 'count', COALESCE(a.c, 0)) ORDER BY months.m)
          FROM months LEFT JOIN agg a ON a.mes = months.m::date AND a.name = t.name
        )
      ))
      FROM top_names t
    ), '[]'::jsonb)
  ) INTO v_comp_prestador;

  v_dias := GREATEST((v_fim - v_ini) + 1, 1);
  v_prev_fim := v_ini - 1;
  v_prev_ini := v_prev_fim - (v_dias - 1);

  v_cur_total := COALESCE((v_totais->>'total')::int, 0);
  v_cur_atr := COALESCE((v_totais->>'atrasadas')::int, 0);
  v_cur_fin := COALESCE((v_totais->>'finalizadas')::int, 0);

  WITH base AS (
    SELECT
      public.guias_sla_status(COALESCE(g.data_agendamento, g.data_guia), gg.atendimento_lancado::text, gg.sla_final) AS sla,
      public.guias_status_guia(
        COALESCE(gg.compareceu_status::text,'NAO_INFORMADO'),
        COALESCE(gg.atendimento_lancado::text,'NAO_INFORMADO'),
        COALESCE(gg.aso_anexado::text,'NAO_INFORMADO'),
        COALESCE(gg.aguardando_aso::text,'NAO_INFORMADO')
      ) AS status_guia
    FROM public.guias g LEFT JOIN public.guia_gestao gg ON gg.guia_codigo = g.guia_codigo
    WHERE g.data_guia BETWEEN v_prev_ini AND v_prev_fim
      AND g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(COALESCE(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL)
  )
  SELECT count(*)::int,
    count(*) FILTER (WHERE sla='ATRASADO')::int,
    count(*) FILTER (WHERE status_guia='FINALIZADA')::int
  INTO v_prev_total, v_prev_atr, v_prev_fin
  FROM base;

  v_variacao := jsonb_build_object(
    'periodo_anterior_ini', to_char(v_prev_ini,'YYYY-MM-DD'),
    'periodo_anterior_fim', to_char(v_prev_fim,'YYYY-MM-DD'),
    'total', jsonb_build_object('atual', v_cur_total, 'anterior', v_prev_total,
      'delta', v_cur_total - v_prev_total,
      'pct', CASE WHEN v_prev_total > 0 THEN round(((v_cur_total - v_prev_total)::numeric / v_prev_total) * 100, 1) ELSE NULL END),
    'atrasadas', jsonb_build_object('atual', v_cur_atr, 'anterior', v_prev_atr,
      'delta', v_cur_atr - v_prev_atr,
      'pct', CASE WHEN v_prev_atr > 0 THEN round(((v_cur_atr - v_prev_atr)::numeric / v_prev_atr) * 100, 1) ELSE NULL END),
    'finalizadas', jsonb_build_object('atual', v_cur_fin, 'anterior', v_prev_fin,
      'delta', v_cur_fin - v_prev_fin,
      'pct', CASE WHEN v_prev_fin > 0 THEN round(((v_cur_fin - v_prev_fin)::numeric / v_prev_fin) * 100, 1) ELSE NULL END)
  );

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
    'sla_mensal', v_sla_mensal,
    'comparativo_empresa', v_comp_empresa,
    'comparativo_prestador', v_comp_prestador,
    'variacao', v_variacao
  );

  RETURN v_result;
END;
$function$;