
ALTER TABLE public.commercial_clients ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.contract_clientes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_clients_company_id ON public.commercial_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_clientes_company_id ON public.contract_clientes(company_id);

-- Backfill using normalized CNPJ (only digits)
WITH normalized AS (
  SELECT id, regexp_replace(coalesce(cnpj,''), '\D', '', 'g') AS n_cnpj
  FROM public.companies
  WHERE cnpj IS NOT NULL AND length(regexp_replace(coalesce(cnpj,''), '\D', '', 'g')) = 14
),
first_match AS (
  SELECT DISTINCT ON (n_cnpj) n_cnpj, id FROM normalized ORDER BY n_cnpj, id
)
UPDATE public.commercial_clients cc
SET company_id = fm.id
FROM first_match fm
WHERE cc.company_id IS NULL
  AND regexp_replace(coalesce(cc.cnpj,''), '\D', '', 'g') = fm.n_cnpj
  AND length(regexp_replace(coalesce(cc.cnpj,''), '\D', '', 'g')) = 14;

WITH normalized AS (
  SELECT id, regexp_replace(coalesce(cnpj,''), '\D', '', 'g') AS n_cnpj
  FROM public.companies
  WHERE cnpj IS NOT NULL AND length(regexp_replace(coalesce(cnpj,''), '\D', '', 'g')) = 14
),
first_match AS (
  SELECT DISTINCT ON (n_cnpj) n_cnpj, id FROM normalized ORDER BY n_cnpj, id
)
UPDATE public.contract_clientes cc
SET company_id = fm.id
FROM first_match fm
WHERE cc.company_id IS NULL
  AND regexp_replace(coalesce(cc.cnpj,''), '\D', '', 'g') = fm.n_cnpj
  AND length(regexp_replace(coalesce(cc.cnpj,''), '\D', '', 'g')) = 14;
