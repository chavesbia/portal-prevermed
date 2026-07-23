ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_cnpj_key;

CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies (cnpj);