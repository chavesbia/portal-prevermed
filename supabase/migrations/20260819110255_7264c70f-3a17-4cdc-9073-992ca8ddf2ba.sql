-- Add CPF column to profissionais
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Create partial unique index to prevent duplicate CPFs (ignoring nulls)
DROP INDEX IF EXISTS public.profissionais_cpf_unique_idx;
CREATE UNIQUE INDEX profissionais_cpf_unique_idx ON public.profissionais (cpf) WHERE (cpf IS NOT NULL);

-- Add comment for clarity
COMMENT ON COLUMN public.profissionais.cpf IS 'CPF do profissional (somente números)';
