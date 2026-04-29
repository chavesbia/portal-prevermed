-- Reverte adições do catálogo paralelo em commercial_services e o vínculo service_id em renewal_quotation_items.
-- O catálogo de serviços da Renovação passará a usar a tabela `services` (mesma do In Loco).

ALTER TABLE public.renewal_quotation_items
  DROP COLUMN IF EXISTS service_id,
  DROP COLUMN IF EXISTS in_monthly_package;

ALTER TABLE public.commercial_services
  DROP COLUMN IF EXISTS is_priceable,
  DROP COLUMN IF EXISTS cost_value,
  DROP COLUMN IF EXISTS price_standalone,
  DROP COLUMN IF EXISTS price_in_plan,
  DROP COLUMN IF EXISTS pricing_notes;

-- Re-adiciona apenas o vínculo opcional ao serviço da BASE oficial (tabela `services` do In Loco)
ALTER TABLE public.renewal_quotation_items
  ADD COLUMN service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN in_monthly_package boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_renewal_items_service ON public.renewal_quotation_items(service_id);