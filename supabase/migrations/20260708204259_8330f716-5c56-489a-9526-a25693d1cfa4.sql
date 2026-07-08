
DO $$ BEGIN
  CREATE TYPE public.os_anexo_categoria AS ENUM ('contrato', 'art', 'laudo', 'foto', 'relatorio', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.os_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  servico_os_id UUID REFERENCES public.servicos_os(id) ON DELETE SET NULL,
  categoria public.os_anexo_categoria NOT NULL DEFAULT 'outro',
  nome TEXT NOT NULL,
  descricao TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  data_vencimento DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_anexos_ordem ON public.os_anexos(ordem_id);
CREATE INDEX IF NOT EXISTS idx_os_anexos_servico ON public.os_anexos(servico_os_id);
CREATE INDEX IF NOT EXISTS idx_os_anexos_categoria ON public.os_anexos(categoria);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_anexos TO authenticated;
GRANT ALL ON public.os_anexos TO service_role;

ALTER TABLE public.os_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view os_anexos"
  ON public.os_anexos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors insert os_anexos"
  ON public.os_anexos FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "Editors update os_anexos"
  ON public.os_anexos FOR UPDATE TO authenticated
  USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "ADM master delete os_anexos"
  ON public.os_anexos FOR DELETE TO authenticated
  USING (public.is_adm_master());

CREATE TRIGGER trg_os_anexos_updated_at
  BEFORE UPDATE ON public.os_anexos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.historico_anexo_os()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome TEXT;
BEGIN
  SELECT COALESCE(p.full_name, u.email, 'Sistema') INTO v_nome
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = COALESCE(NEW.created_by, OLD.created_by, auth.uid());

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historico_os (ordem_id, user_id, user_name, acao, comentario)
    VALUES (NEW.ordem_id, NEW.created_by, v_nome, 'Anexo adicionado',
      format('Anexo "%s" (%s) adicionado.', NEW.nome, NEW.categoria));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.historico_os (ordem_id, user_id, user_name, acao, comentario)
    VALUES (OLD.ordem_id, auth.uid(), v_nome, 'Anexo removido',
      format('Anexo "%s" removido.', OLD.nome));
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_historico_anexo_os
  AFTER INSERT OR DELETE ON public.os_anexos
  FOR EACH ROW EXECUTE FUNCTION public.historico_anexo_os();

CREATE POLICY "Auth users read os-anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'os-anexos');

CREATE POLICY "Editors upload os-anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'os-anexos'
    AND (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os')));

CREATE POLICY "Editors update os-anexos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'os-anexos'
    AND (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os')));

CREATE POLICY "ADM master delete os-anexos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'os-anexos' AND public.is_adm_master());

CREATE OR REPLACE VIEW public.vw_os_alertas
WITH (security_invoker = true) AS
SELECT
  'sla'::text AS tipo,
  CASE
    WHEN o.prazo_acordado < CURRENT_DATE THEN 'atrasado'
    WHEN o.prazo_acordado <= CURRENT_DATE + 3 THEN 'atencao'
  END AS severidade,
  o.id AS ordem_id,
  o.numero_os,
  o.empresa_cliente,
  o.responsavel_atual,
  o.prazo_acordado AS referencia_data,
  format('OS %s — prazo %s', o.numero_os, to_char(o.prazo_acordado, 'DD/MM/YYYY')) AS descricao
FROM public.ordens_servico o
WHERE o.status_os <> 'Encerrado'
  AND o.prazo_acordado IS NOT NULL
  AND o.prazo_acordado <= CURRENT_DATE + 3

UNION ALL

SELECT
  'servico_parado'::text,
  'atencao'::text,
  s.ordem_id,
  o.numero_os,
  o.empresa_cliente,
  o.responsavel_atual,
  s.updated_at::date,
  format('Serviço %s parado em "%s" há %s dias',
    s.tipo, s.status,
    EXTRACT(day FROM (now() - s.updated_at))::int)
FROM public.servicos_os s
JOIN public.ordens_servico o ON o.id = s.ordem_id
WHERE s.status IN ('Aguardando cliente', 'Em revisão interna')
  AND s.updated_at < now() - INTERVAL '10 days'

UNION ALL

SELECT
  'laudo_vencendo'::text,
  CASE WHEN l.data_validade < CURRENT_DATE THEN 'atrasado' ELSE 'atencao' END,
  l.ordem_id,
  l.numero_os,
  l.empresa_cliente,
  l.responsavel_tecnico_nome,
  l.data_validade,
  format('Laudo %s vence em %s', l.tipo_laudo_nome, to_char(l.data_validade, 'DD/MM/YYYY'))
FROM public.laudos l
WHERE l.possui_vigencia = true
  AND l.data_validade IS NOT NULL
  AND l.data_validade <= CURRENT_DATE + 30

UNION ALL

SELECT
  'orcamento_estourado'::text,
  'atrasado'::text,
  o.id,
  o.numero_os,
  o.empresa_cliente,
  o.responsavel_atual,
  CURRENT_DATE,
  format('Custos R$ %s excederam orçamento R$ %s',
    to_char(COALESCE(c.total, 0), 'FM999G999D00'),
    to_char(o.orcamento_custo, 'FM999G999D00'))
FROM public.ordens_servico o
LEFT JOIN (
  SELECT ordem_id, SUM(valor) AS total FROM public.os_custos GROUP BY ordem_id
) c ON c.ordem_id = o.id
WHERE o.orcamento_custo IS NOT NULL
  AND o.orcamento_custo > 0
  AND COALESCE(c.total, 0) > o.orcamento_custo
  AND o.status_os <> 'Encerrado';

GRANT SELECT ON public.vw_os_alertas TO authenticated;

CREATE OR REPLACE VIEW public.vw_os_produtividade
WITH (security_invoker = true) AS
SELECT
  o.responsavel_atual AS responsavel,
  COUNT(DISTINCT o.id) AS total_os,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status_os = 'Encerrado') AS os_encerradas,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status_os = 'Em andamento') AS os_em_andamento,
  COUNT(DISTINCT o.id) FILTER (WHERE o.prazo_acordado < CURRENT_DATE AND o.status_os <> 'Encerrado') AS os_atrasadas,
  COUNT(DISTINCT s.id) AS total_servicos,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'Encerrado') AS servicos_encerrados,
  AVG(EXTRACT(epoch FROM (o.updated_at - o.data_registro::timestamp)) / 86400)
    FILTER (WHERE o.status_os = 'Encerrado') AS tempo_medio_dias
FROM public.ordens_servico o
LEFT JOIN public.servicos_os s ON s.ordem_id = o.id
WHERE o.data_registro >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY o.responsavel_atual;

GRANT SELECT ON public.vw_os_produtividade TO authenticated;
