CREATE TABLE public.soc_pedidos_socnet (
  sequencial_ficha text PRIMARY KEY,
  cpf text NOT NULL,
  data_ficha text,
  tipo_exame text,
  empresa_codigo text,
  empresa_nome text,
  assessoria_codigo text,
  assessoria_nome text,
  funcionario jsonb NOT NULL DEFAULT '{}'::jsonb,
  exames text[] NOT NULL DEFAULT '{}',
  pendentes integer NOT NULL DEFAULT 0,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.soc_pedidos_socnet TO authenticated;
GRANT ALL ON public.soc_pedidos_socnet TO service_role;
ALTER TABLE public.soc_pedidos_socnet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agenda le pedidos socnet" ON public.soc_pedidos_socnet FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/agendamentos'));
CREATE INDEX idx_soc_pedidos_socnet_cpf ON public.soc_pedidos_socnet(cpf);
COMMENT ON TABLE public.soc_pedidos_socnet IS 'Cópia local dos pedidos SOCNET (Exporta 221785) direcionados à PreverMed; alimentada por soc-pedidos-sync e lida pela Agenda sem consultar o SOC a cada CPF.';