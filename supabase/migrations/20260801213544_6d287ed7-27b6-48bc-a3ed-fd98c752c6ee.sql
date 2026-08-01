DROP VIEW IF EXISTS public.vw_os_produtividade;

CREATE VIEW public.vw_os_produtividade
WITH (security_invoker = true) AS
SELECT
  COALESCE(p.nome, 'Não atribuído') AS responsavel,
  count(DISTINCT o.id) AS total_os,
  count(DISTINCT o.id) FILTER (WHERE o.status_os = 'Encerrado') AS os_encerradas,
  count(DISTINCT o.id) FILTER (WHERE o.status_os = 'Em andamento') AS os_em_andamento,
  count(DISTINCT o.id) FILTER (WHERE o.prazo_acordado < CURRENT_DATE AND o.status_os <> 'Encerrado') AS os_atrasadas,
  count(DISTINCT s.id) AS total_servicos,
  count(DISTINCT s.id) FILTER (WHERE s.status = 'Encerrado') AS servicos_encerrados,
  avg(EXTRACT(epoch FROM o.updated_at - o.data_registro::timestamp::timestamptz) / 86400::numeric)
    FILTER (WHERE o.status_os = 'Encerrado') AS tempo_medio_dias
FROM public.servicos_os s
JOIN public.ordens_servico o ON o.id = s.ordem_id
LEFT JOIN public.profissionais p ON p.id = s.responsavel_id
WHERE o.data_registro >= (CURRENT_DATE - '90 days'::interval)
GROUP BY COALESCE(p.nome, 'Não atribuído');

GRANT SELECT ON public.vw_os_produtividade TO authenticated;
GRANT ALL ON public.vw_os_produtividade TO service_role;