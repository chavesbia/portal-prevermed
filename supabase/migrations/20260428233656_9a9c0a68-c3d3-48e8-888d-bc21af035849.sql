-- 1) Estender commercial_services com campos de precificação
ALTER TABLE public.commercial_services
  ADD COLUMN IF NOT EXISTS is_priceable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS cost_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS price_standalone numeric(12,2),
  ADD COLUMN IF NOT EXISTS price_in_plan numeric(12,2),
  ADD COLUMN IF NOT EXISTS pricing_notes text;

-- 2) Endurecer permissões: catálogo central só ADM Master pode mexer
DROP POLICY IF EXISTS "Admins can insert commercial_services" ON public.commercial_services;
DROP POLICY IF EXISTS "Admins can update commercial_services" ON public.commercial_services;

CREATE POLICY "ADM Master can insert commercial_services"
ON public.commercial_services
FOR INSERT
TO authenticated
WITH CHECK (is_adm_master());

CREATE POLICY "ADM Master can update commercial_services"
ON public.commercial_services
FOR UPDATE
TO authenticated
USING (is_adm_master());

-- 3) Adicionar campos no item de renovação para suportar vinculação ao catálogo
ALTER TABLE public.renewal_quotation_items
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.commercial_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS in_monthly_package boolean NOT NULL DEFAULT false;

-- 4) Trigger para manter updated_at consistente
DROP TRIGGER IF EXISTS trg_commercial_services_updated_at ON public.commercial_services;
CREATE TRIGGER trg_commercial_services_updated_at
BEFORE UPDATE ON public.commercial_services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();