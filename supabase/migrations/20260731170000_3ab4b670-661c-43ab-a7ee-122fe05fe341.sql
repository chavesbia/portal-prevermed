ALTER TABLE public.laudos
  ALTER COLUMN ordem_id DROP NOT NULL,
  ALTER COLUMN servico_id DROP NOT NULL,
  ALTER COLUMN numero_os DROP NOT NULL;

ALTER TABLE public.laudos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'gerado_por_os';

ALTER TABLE public.laudos
  DROP CONSTRAINT IF EXISTS laudos_origem_check;
ALTER TABLE public.laudos
  ADD CONSTRAINT laudos_origem_check CHECK (origem IN ('gerado_por_os','cadastro_manual'));

UPDATE public.laudos SET origem = 'gerado_por_os' WHERE origem IS NULL;

UPDATE public.tipos_laudo SET exige_vigencia = true WHERE nome = 'LTCAT';