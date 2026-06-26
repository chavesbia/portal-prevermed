ALTER TABLE public.contract_contratos
ADD COLUMN IF NOT EXISTS campos_personalizados JSONB NOT NULL DEFAULT '{}'::jsonb;