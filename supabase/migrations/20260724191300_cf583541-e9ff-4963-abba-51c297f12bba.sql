
ALTER TABLE public.guias
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guias_company_id ON public.guias(company_id);

SET session_replication_role = replica;

UPDATE public.guias g
SET company_id = c.id
FROM public.companies c
WHERE g.company_id IS NULL
  AND g.empresa_codigo IS NOT NULL
  AND c.soc_code = g.empresa_codigo;

SET session_replication_role = origin;
