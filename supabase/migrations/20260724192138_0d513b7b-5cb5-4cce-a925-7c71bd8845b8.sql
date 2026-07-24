
ALTER TABLE public.laudos
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_laudos_company_id ON public.laudos(company_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_company_id ON public.ordens_servico(company_id);

SET session_replication_role = replica;

UPDATE public.laudos l
SET company_id = c.id
FROM public.companies c
WHERE l.company_id IS NULL
  AND l.empresa_cliente IS NOT NULL
  AND (
    lower(btrim(c.razao_social)) = lower(btrim(l.empresa_cliente))
    OR lower(btrim(c.nome_abreviado)) = lower(btrim(l.empresa_cliente))
  );

UPDATE public.ordens_servico o
SET company_id = c.id
FROM public.companies c
WHERE o.company_id IS NULL
  AND o.empresa_cliente IS NOT NULL
  AND (
    lower(btrim(c.razao_social)) = lower(btrim(o.empresa_cliente))
    OR lower(btrim(c.nome_abreviado)) = lower(btrim(o.empresa_cliente))
  );

SET session_replication_role = origin;
