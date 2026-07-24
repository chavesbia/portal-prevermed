
ALTER TABLE public.occurrence_tickets
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.aso_retificacao_solicitacoes
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_occurrence_tickets_company_id ON public.occurrence_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_aso_retificacao_solicitacoes_company_id ON public.aso_retificacao_solicitacoes(company_id);

SET session_replication_role = replica;

UPDATE public.occurrence_tickets t
SET company_id = c.id
FROM public.companies c
WHERE t.company_id IS NULL
  AND t.cnpj IS NOT NULL
  AND regexp_replace(t.cnpj, '[^0-9]', '', 'g') <> ''
  AND regexp_replace(t.cnpj, '[^0-9]', '', 'g') = regexp_replace(coalesce(c.cnpj,''), '[^0-9]', '', 'g');

UPDATE public.aso_retificacao_solicitacoes s
SET company_id = c.id
FROM public.companies c
WHERE s.company_id IS NULL
  AND s.cnpj IS NOT NULL
  AND regexp_replace(s.cnpj, '[^0-9]', '', 'g') <> ''
  AND regexp_replace(s.cnpj, '[^0-9]', '', 'g') = regexp_replace(coalesce(c.cnpj,''), '[^0-9]', '', 'g');

SET session_replication_role = origin;
