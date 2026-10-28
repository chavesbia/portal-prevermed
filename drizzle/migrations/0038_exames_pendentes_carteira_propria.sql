ALTER TABLE public.soc_exames_pendentes ADD COLUMN IF NOT EXISTS verificado_em timestamptz;
CREATE INDEX IF NOT EXISTS soc_exames_pendentes_ficha_idx ON public.soc_exames_pendentes (origem, sequencial_ficha);
CREATE TABLE IF NOT EXISTS public.soc_sync_estado (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.soc_sync_estado TO service_role;
ALTER TABLE public.soc_sync_estado ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.soc_sync_estado IS 'Cursor das rotinas SOC em lotes (ex.: varredura de exames da carteira própria). Só service_role.';