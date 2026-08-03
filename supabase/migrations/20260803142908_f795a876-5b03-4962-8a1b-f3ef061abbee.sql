-- 1) OS antigas: match exato por razão social / nome abreviado (único)
UPDATE public.ordens_servico o
SET company_id = c.id
FROM public.companies c
WHERE o.company_id IS NULL
  AND o.empresa_cliente IS NOT NULL
  AND (
    upper(btrim(c.razao_social)) = upper(btrim(regexp_replace(o.empresa_cliente,'\s+',' ','g')))
    OR upper(btrim(coalesce(c.nome_abreviado,''))) = upper(btrim(regexp_replace(o.empresa_cliente,'\s+',' ','g')))
  );

-- 2) OS antigas: match por prefixo, apenas quando houver exatamente 1 candidata
WITH n AS (
  SELECT id, upper(btrim(regexp_replace(regexp_replace(coalesce(empresa_cliente,''),'\(.*',''),'\s+',' ','g'))) AS e
  FROM public.ordens_servico
  WHERE company_id IS NULL AND coalesce(empresa_cliente,'') <> ''
), m AS (
  SELECT n.id, min(c.id::text)::uuid AS company_id, count(*) AS qtd
  FROM n
  JOIN public.companies c
    ON upper(btrim(c.razao_social)) LIKE n.e || '%'
    OR n.e LIKE upper(btrim(c.razao_social)) || '%'
  WHERE length(n.e) >= 6
  GROUP BY n.id
)
UPDATE public.ordens_servico o
SET company_id = m.company_id
FROM m
WHERE o.id = m.id AND m.qtd = 1 AND o.company_id IS NULL;

-- 3) Laudos: herdar empresa da OS de origem
UPDATE public.laudos l
SET company_id = o.company_id
FROM public.ordens_servico o
WHERE l.company_id IS NULL AND l.ordem_id = o.id AND o.company_id IS NOT NULL;

-- 4) Laudos avulsos: match exato por nome
UPDATE public.laudos l
SET company_id = c.id
FROM public.companies c
WHERE l.company_id IS NULL
  AND coalesce(l.empresa_cliente,'') <> ''
  AND (
    upper(btrim(c.razao_social)) = upper(btrim(regexp_replace(l.empresa_cliente,'\s+',' ','g')))
    OR upper(btrim(coalesce(c.nome_abreviado,''))) = upper(btrim(regexp_replace(l.empresa_cliente,'\s+',' ','g')))
  );