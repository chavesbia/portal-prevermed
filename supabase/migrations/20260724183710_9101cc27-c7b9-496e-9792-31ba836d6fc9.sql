CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "adm_master manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.is_adm_master())
  WITH CHECK (public.is_adm_master());

INSERT INTO public.app_settings (key, value)
VALUES ('socnet_sync_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;