-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indices on guias
CREATE INDEX IF NOT EXISTS idx_guias_data_guia ON public.guias (data_guia DESC);
CREATE INDEX IF NOT EXISTS idx_guias_data_agendamento ON public.guias (data_agendamento);
CREATE INDEX IF NOT EXISTS idx_guias_empresa_nome ON public.guias (empresa_nome);
CREATE INDEX IF NOT EXISTS idx_guias_prestador_nome ON public.guias (prestador_nome);
CREATE INDEX IF NOT EXISTS idx_guias_situacao ON public.guias (situacao);
CREATE INDEX IF NOT EXISTS idx_guias_tipo_exame ON public.guias (tipo_exame);
CREATE INDEX IF NOT EXISTS idx_guias_unidade ON public.guias (unidade_nome);
CREATE INDEX IF NOT EXISTS idx_guias_funcionario_cpf ON public.guias (funcionario_cpf);
CREATE INDEX IF NOT EXISTS idx_guias_funcionario_nome_trgm ON public.guias USING gin (funcionario_nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_guias_guia_codigo_trgm ON public.guias USING gin (guia_codigo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_guias_empresa_nome_trgm ON public.guias USING gin (empresa_nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_guias_prestador_nome_trgm ON public.guias USING gin (prestador_nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_guia_gestao_codigo ON public.guia_gestao (guia_codigo);

-- Business-day helper (counts weekdays in (start, end] excluding feriados)
CREATE OR REPLACE FUNCTION public.guias_business_days(_start date, _end date)
RETURNS int LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _start IS NULL OR _end IS NULL OR _end <= _start THEN 0
    ELSE COALESCE((
      SELECT count(*)::int
      FROM generate_series(_start + 1, _end, interval '1 day') AS d(day)
      WHERE EXTRACT(ISODOW FROM d.day) < 6
        AND d.day::date NOT IN (SELECT data FROM public.feriados)
    ), 0)
  END;
$$;

-- SLA status
CREATE OR REPLACE FUNCTION public.guias_sla_status(_data_base date, _atendimento_lancado text, _sla_final text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _sla_final IN ('EM_DIA','ATENCAO','ATRASADO') THEN _sla_final
    WHEN _data_base IS NULL THEN 'EM_DIA'
    ELSE (
      CASE
        WHEN public.guias_business_days(_data_base, CURRENT_DATE) >= 5 THEN 'ATRASADO'
        WHEN public.guias_business_days(_data_base, CURRENT_DATE) >= 4 THEN 'ATENCAO'
        ELSE 'EM_DIA'
      END
    )
  END;
$$;

-- Derive operational Status da Guia
CREATE OR REPLACE FUNCTION public.guias_status_guia(_comp text, _atend text, _aso text, _aguardando text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _comp = 'NAO_COMPARECEU' THEN 'FINALIZADA'
    WHEN _comp IN ('COMPARECEU','PARCIAL') AND _atend = 'SIM' AND _aso = 'SIM' THEN 'FINALIZADA'
    WHEN _comp IN ('COMPARECEU','PARCIAL') AND _atend = 'SIM' THEN 'EM_ANDAMENTO'
    WHEN _comp IN ('COMPARECEU','PARCIAL') AND _aguardando IS NOT NULL AND _aguardando NOT IN ('NAO_INFORMADO','RECEBIDO') THEN 'EM_ANDAMENTO'
    WHEN _comp IN ('COMPARECEU','PARCIAL') THEN 'INICIADA'
    ELSE 'PENDENTE'
  END;
$$;

-- Main listing RPC
CREATE OR REPLACE FUNCTION public.listar_guias(
  _filters jsonb DEFAULT '{}'::jsonb,
  _sort_field text DEFAULT 'data_guia',
  _sort_dir text DEFAULT 'desc',
  _page int DEFAULT 0,
  _page_size int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_rows jsonb;
  v_sort_field text := lower(coalesce(_sort_field,'data_guia'));
  v_sort_dir text := CASE WHEN lower(coalesce(_sort_dir,'desc')) = 'asc' THEN 'ASC' ELSE 'DESC' END;

  -- Filters extraction
  v_search text := nullif(trim(coalesce(_filters->>'search','')), '');
  v_data_guia_ini date := nullif(_filters->>'dataGuiaInicio','')::date;
  v_data_guia_fim date := nullif(_filters->>'dataGuiaFim','')::date;
  v_data_ag_ini date := nullif(_filters->>'dataAgendamentoInicio','')::date;
  v_data_ag_fim date := nullif(_filters->>'dataAgendamentoFim','')::date;
  v_sem_ag bool := coalesce((_filters->>'semAgendamento')::bool, false);
  v_empresas text[] := CASE WHEN jsonb_typeof(_filters->'empresas')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(_filters->'empresas')) ELSE NULL END;
  v_prestadores text[] := CASE WHEN jsonb_typeof(_filters->'prestadores')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(_filters->'prestadores')) ELSE NULL END;
  v_tipo_exame text := nullif(_filters->>'tipoExame','');
  v_situacao text := nullif(_filters->>'situacao','');
  v_unidade text := nullif(_filters->>'unidade','');
  v_atendido text := nullif(_filters->>'atendido','');
  v_sla text := nullif(_filters->>'sla','');
  v_compareceu text := nullif(_filters->>'compareceu','');
  v_atend_lancado text := nullif(_filters->>'atendimentoLancado','');
  v_aso_anexado text := nullif(_filters->>'asoAnexado','');
  v_aguardando_aso text := nullif(_filters->>'aguardandoAso','');
  v_origem text := nullif(_filters->>'origemAgendamento','');
  v_status_prest text := nullif(_filters->>'statusPrestador','');
  v_status_guia text := nullif(_filters->>'statusGuia','');
  v_exame text := nullif(_filters->>'exame','');
BEGIN
  IF v_sort_field NOT IN ('data_guia','guia_codigo','empresa_nome','prestador_nome','funcionario_nome','data_agendamento','sla','status_guia') THEN
    v_sort_field := 'data_guia';
  END IF;

  -- Build filtered set in a CTE
  WITH base AS (
    SELECT
      g.id,
      g.guia_codigo,
      g.data_guia,
      g.empresa_nome,
      g.prestador_nome,
      g.funcionario_nome,
      g.funcionario_cpf,
      g.tipo_exame,
      g.atendido_texto,
      g.data_agendamento,
      g.hora_agendamento,
      g.situacao,
      g.solicitante_nome,
      g.unidade_nome,
      coalesce(gg.compareceu_status::text,'NAO_INFORMADO') AS compareceu,
      coalesce(gg.atendimento_lancado::text,'NAO_INFORMADO') AS atendimento_lancado,
      coalesce(gg.aso_anexado::text,'NAO_INFORMADO') AS aso_anexado,
      coalesce(gg.aguardando_aso::text,'NAO_INFORMADO') AS aguardando_aso,
      gg.sla_final,
      public.guias_sla_status(coalesce(g.data_agendamento, g.data_guia), gg.atendimento_lancado::text, gg.sla_final) AS sla,
      public.guias_status_guia(
        coalesce(gg.compareceu_status::text,'NAO_INFORMADO'),
        coalesce(gg.atendimento_lancado::text,'NAO_INFORMADO'),
        coalesce(gg.aso_anexado::text,'NAO_INFORMADO'),
        coalesce(gg.aguardando_aso::text,'NAO_INFORMADO')
      ) AS status_guia,
      CASE WHEN g.solicitante_nome IS NOT NULL AND upper(g.solicitante_nome) LIKE '%EMPRESA:%' THEN 'CLIENTE' ELSE 'PREVERMED' END AS origem,
      CASE WHEN g.prestador_nome IS NULL OR btrim(g.prestador_nome) = '' THEN 'SEM PRESTADOR' ELSE 'COM PRESTADOR' END AS status_prestador
    FROM public.guias g
    LEFT JOIN public.guia_gestao gg ON gg.guia_codigo = g.guia_codigo
    WHERE g.data_guia >= DATE '2026-01-01'
      AND NOT EXISTS (
        SELECT 1 FROM public.prestadores_bloqueados pb
        WHERE pb.nome_normalizado = lower(regexp_replace(btrim(coalesce(g.prestador_nome,'')), '\s+', ' ', 'g'))
          AND g.prestador_nome IS NOT NULL
      )
      AND (v_search IS NULL
        OR g.guia_codigo ILIKE '%'||v_search||'%'
        OR g.funcionario_nome ILIKE '%'||v_search||'%'
        OR g.funcionario_cpf ILIKE '%'||v_search||'%'
        OR g.empresa_nome ILIKE '%'||v_search||'%'
        OR g.prestador_nome ILIKE '%'||v_search||'%')
      AND (v_data_guia_ini IS NULL OR g.data_guia >= v_data_guia_ini)
      AND (v_data_guia_fim IS NULL OR g.data_guia <= v_data_guia_fim)
      AND (v_data_ag_ini IS NULL OR g.data_agendamento >= v_data_ag_ini)
      AND (v_data_ag_fim IS NULL OR g.data_agendamento <= v_data_ag_fim)
      AND (NOT v_sem_ag OR (g.data_agendamento IS NULL AND (g.hora_agendamento IS NULL OR g.hora_agendamento = '00:00')))
      AND (v_empresas IS NULL OR g.empresa_nome = ANY(v_empresas))
      AND (v_prestadores IS NULL OR g.prestador_nome = ANY(v_prestadores))
      AND (v_tipo_exame IS NULL OR g.tipo_exame = v_tipo_exame)
      AND (v_situacao IS NULL OR g.situacao = v_situacao)
      AND (v_unidade IS NULL OR g.unidade_nome = v_unidade)
      AND (v_atendido IS NULL
        OR (v_atendido = 'SIM' AND upper(coalesce(g.atendido_texto,'')) = 'SIM')
        OR (v_atendido = 'NAO' AND upper(coalesce(g.atendido_texto,'')) <> 'SIM'))
      AND (v_exame IS NULL OR EXISTS (
        SELECT 1 FROM public.guia_exames ge WHERE ge.guia_codigo = g.guia_codigo AND ge.exame_nome = v_exame))
  ), filtered AS (
    SELECT * FROM base
    WHERE (v_compareceu IS NULL OR compareceu = v_compareceu)
      AND (v_atend_lancado IS NULL OR atendimento_lancado = v_atend_lancado)
      AND (v_aso_anexado IS NULL OR aso_anexado = v_aso_anexado)
      AND (v_aguardando_aso IS NULL OR aguardando_aso = v_aguardando_aso)
      AND (v_sla IS NULL OR sla = v_sla)
      AND (v_status_guia IS NULL OR status_guia = v_status_guia)
      AND (v_origem IS NULL OR origem = v_origem)
      AND (v_status_prest IS NULL OR status_prestador = v_status_prest)
  ), counted AS (
    SELECT count(*) AS total FROM filtered
  ), sorted AS (
    SELECT *,
      CASE sla WHEN 'EM_DIA' THEN 0 WHEN 'ATENCAO' THEN 1 WHEN 'ATRASADO' THEN 2 ELSE 3 END AS sla_order,
      CASE status_guia WHEN 'PENDENTE' THEN 0 WHEN 'INICIADA' THEN 1 WHEN 'EM_ANDAMENTO' THEN 2 WHEN 'FINALIZADA' THEN 3 ELSE 4 END AS status_order
    FROM filtered
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(jsonb_agg(to_jsonb(s) - 'sla_order' - 'status_order'), '[]'::jsonb)
  INTO v_total, v_rows
  FROM (
    SELECT * FROM sorted
    ORDER BY
      CASE WHEN v_sort_field = 'sla' AND v_sort_dir = 'ASC' THEN sla_order END ASC,
      CASE WHEN v_sort_field = 'sla' AND v_sort_dir = 'DESC' THEN sla_order END DESC,
      CASE WHEN v_sort_field = 'status_guia' AND v_sort_dir = 'ASC' THEN status_order END ASC,
      CASE WHEN v_sort_field = 'status_guia' AND v_sort_dir = 'DESC' THEN status_order END DESC,
      CASE WHEN v_sort_field = 'data_guia' AND v_sort_dir = 'ASC' THEN data_guia END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'data_guia' AND v_sort_dir = 'DESC' THEN data_guia END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'data_agendamento' AND v_sort_dir = 'ASC' THEN data_agendamento END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'data_agendamento' AND v_sort_dir = 'DESC' THEN data_agendamento END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'guia_codigo' AND v_sort_dir = 'ASC' THEN guia_codigo END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'guia_codigo' AND v_sort_dir = 'DESC' THEN guia_codigo END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'empresa_nome' AND v_sort_dir = 'ASC' THEN empresa_nome END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'empresa_nome' AND v_sort_dir = 'DESC' THEN empresa_nome END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'prestador_nome' AND v_sort_dir = 'ASC' THEN prestador_nome END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'prestador_nome' AND v_sort_dir = 'DESC' THEN prestador_nome END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'funcionario_nome' AND v_sort_dir = 'ASC' THEN funcionario_nome END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'funcionario_nome' AND v_sort_dir = 'DESC' THEN funcionario_nome END DESC NULLS LAST,
      data_guia DESC NULLS LAST
    LIMIT GREATEST(_page_size, 1)
    OFFSET GREATEST(_page, 0) * GREATEST(_page_size, 1)
  ) s;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_guias(jsonb, text, text, int, int) TO authenticated;

-- Filter options RPC
CREATE OR REPLACE FUNCTION public.guias_filtros_disponiveis()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'empresas', COALESCE((SELECT jsonb_agg(DISTINCT empresa_nome ORDER BY empresa_nome) FROM public.guias WHERE empresa_nome IS NOT NULL AND data_guia >= DATE '2026-01-01'), '[]'::jsonb),
    'prestadores', COALESCE((SELECT jsonb_agg(DISTINCT prestador_nome ORDER BY prestador_nome) FROM public.guias WHERE prestador_nome IS NOT NULL AND data_guia >= DATE '2026-01-01'), '[]'::jsonb),
    'tipos_exame', COALESCE((SELECT jsonb_agg(DISTINCT tipo_exame ORDER BY tipo_exame) FROM public.guias WHERE tipo_exame IS NOT NULL AND data_guia >= DATE '2026-01-01'), '[]'::jsonb),
    'situacoes', COALESCE((SELECT jsonb_agg(DISTINCT situacao ORDER BY situacao) FROM public.guias WHERE situacao IS NOT NULL AND data_guia >= DATE '2026-01-01'), '[]'::jsonb),
    'unidades', COALESCE((SELECT jsonb_agg(DISTINCT unidade_nome ORDER BY unidade_nome) FROM public.guias WHERE unidade_nome IS NOT NULL AND data_guia >= DATE '2026-01-01'), '[]'::jsonb),
    'exames', COALESCE((SELECT jsonb_agg(DISTINCT exame_nome ORDER BY exame_nome) FROM public.guia_exames WHERE exame_nome IS NOT NULL), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.guias_filtros_disponiveis() TO authenticated;