
CREATE TABLE public.companies_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  triggered_by UUID,
  total INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.companies_sync_log TO authenticated;
GRANT ALL ON public.companies_sync_log TO service_role;

ALTER TABLE public.companies_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_sync_log_view" ON public.companies_sync_log FOR SELECT
  USING (is_adm_master() OR can_view_module_route(auth.uid(), '/admin/empresas'));

CREATE INDEX idx_companies_sync_log_started_at ON public.companies_sync_log(started_at DESC);
