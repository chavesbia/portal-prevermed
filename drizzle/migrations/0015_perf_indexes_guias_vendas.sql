CREATE INDEX IF NOT EXISTS idx_guia_exames_codigo ON public.guia_exames (guia_codigo);
CREATE INDEX IF NOT EXISTS idx_guia_audit_log_codigo ON public.guia_audit_log (guia_codigo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aso_atend_data_hora ON public.aso_atendimentos (data_atendimento DESC, hora_inicial);
CREATE INDEX IF NOT EXISTS idx_vendas_data_num ON public.vendas (data_venda DESC, numero_venda DESC);
ANALYZE public.guia_exames; ANALYZE public.guia_audit_log; ANALYZE public.vendas; ANALYZE public.venda_itens;