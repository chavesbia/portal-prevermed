-- ============================================================
-- FASE 2: Estrutura editável de Planos e Preços por Faixa
-- ============================================================

-- 1) Tabela de Planos (substitui hardcode A/B/C)
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  billing_model text NOT NULL DEFAULT 'PACOTE_VIDAS',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_recommended boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_plans_billing_chk CHECK (billing_model IN ('AVULSO','PACOTE_VIDAS','POR_ASO'))
);

CREATE TRIGGER trg_pricing_plans_updated
  BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_plans select all auth"
  ON public.pricing_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "pricing_plans manage adm_master"
  ON public.pricing_plans FOR ALL TO authenticated
  USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

-- 2) Preço por (Plano × Serviço × Faixa de vida)
CREATE TABLE IF NOT EXISTS public.plan_service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.pricing_plans(id) ON DELETE CASCADE,
  catalog_service_id uuid NOT NULL REFERENCES public.catalog_services(id) ON DELETE CASCADE,
  life_range_id uuid REFERENCES public.life_ranges(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL DEFAULT 0,
  is_included_in_package boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, catalog_service_id, life_range_id)
);

CREATE TRIGGER trg_plan_service_prices_updated
  BEFORE UPDATE ON public.plan_service_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_psp_plan ON public.plan_service_prices(plan_id);
CREATE INDEX IF NOT EXISTS idx_psp_service ON public.plan_service_prices(catalog_service_id);
CREATE INDEX IF NOT EXISTS idx_psp_range ON public.plan_service_prices(life_range_id);

ALTER TABLE public.plan_service_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psp select all auth"
  ON public.plan_service_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "psp manage adm_master"
  ON public.plan_service_prices FOR ALL TO authenticated
  USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

-- 3) Seed inicial dos 3 planos atuais (idempotente)
INSERT INTO public.pricing_plans (code, name, description, billing_model, display_order, is_recommended)
VALUES
  ('A', 'Plano A - Padrão', 'Cobrança completa com laudos individuais', 'AVULSO', 1, false),
  ('B', 'Plano B - Pacote Vidas', 'Pacote com desconto progressivo por vidas', 'PACOTE_VIDAS', 2, true),
  ('C', 'Plano C - Cobrança ASO', 'Cobrança por ASO realizado', 'POR_ASO', 3, false)
ON CONFLICT (code) DO NOTHING;
