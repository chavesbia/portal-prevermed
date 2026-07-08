
-- Fase 5: Gestão Financeira da OS
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES public.commercial_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receita_prevista NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS orcamento_custo NUMERIC(14,2);

CREATE INDEX IF NOT EXISTS idx_ordens_contrato ON public.ordens_servico(contrato_id);
CREATE INDEX IF NOT EXISTS idx_ordens_quotation ON public.ordens_servico(quotation_id);

-- View consolidada financeira por OS
CREATE OR REPLACE VIEW public.vw_os_financeiro AS
SELECT
  o.id AS ordem_id,
  o.numero_os,
  o.empresa_cliente,
  o.status_os,
  o.data_registro,
  o.data_emissao,
  o.prazo_acordado,
  o.responsavel_atual,
  o.contrato_id,
  o.quotation_id,
  o.receita_prevista,
  o.orcamento_custo,
  COALESCE(SUM(c.valor), 0)::numeric(14,2) AS custo_total,
  COALESCE(o.receita_prevista, 0)::numeric(14,2) - COALESCE(SUM(c.valor), 0)::numeric(14,2) AS margem_valor,
  CASE
    WHEN COALESCE(o.receita_prevista, 0) > 0
      THEN ROUND(((COALESCE(o.receita_prevista, 0) - COALESCE(SUM(c.valor), 0)) / o.receita_prevista) * 100, 2)
    ELSE NULL
  END AS margem_percent,
  CASE
    WHEN COALESCE(o.orcamento_custo, 0) > 0 AND COALESCE(SUM(c.valor), 0) > o.orcamento_custo THEN true
    ELSE false
  END AS custo_estourado
FROM public.ordens_servico o
LEFT JOIN public.os_custos c ON c.ordem_id = o.id
GROUP BY o.id;

GRANT SELECT ON public.vw_os_financeiro TO authenticated;
GRANT SELECT ON public.vw_os_financeiro TO service_role;
