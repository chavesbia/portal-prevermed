CREATE TABLE public.passivos_historico_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passivo_id UUID NOT NULL REFERENCES public.passivos_parcelamentos(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(passivo_id, ano, mes)
);

CREATE INDEX idx_passivos_historico_passivo ON public.passivos_historico_mensal(passivo_id);
CREATE INDEX idx_passivos_historico_periodo ON public.passivos_historico_mensal(ano, mes);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passivos_historico_mensal TO authenticated;
GRANT ALL ON public.passivos_historico_mensal TO service_role;

ALTER TABLE public.passivos_historico_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hist passivos: view com permissão"
ON public.passivos_historico_mensal FOR SELECT TO authenticated
USING (
  public.is_adm_master()
  OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
    WHERE gum.module_route = '/gestao-passivos'
  )
);

CREATE POLICY "Hist passivos: insert com permissão"
ON public.passivos_historico_mensal FOR INSERT TO authenticated
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-passivos')
);

CREATE POLICY "Hist passivos: update com permissão"
ON public.passivos_historico_mensal FOR UPDATE TO authenticated
USING (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-passivos')
)
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-passivos')
);

CREATE POLICY "Hist passivos: delete apenas ADM Master"
ON public.passivos_historico_mensal FOR DELETE TO authenticated
USING (public.is_adm_master());

CREATE TRIGGER trg_passivos_historico_updated_at
BEFORE UPDATE ON public.passivos_historico_mensal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_passivo_cnpj_acordo
ON public.passivos_parcelamentos(cnpj, numero_acordo)
WHERE numero_acordo IS NOT NULL AND numero_acordo <> '';