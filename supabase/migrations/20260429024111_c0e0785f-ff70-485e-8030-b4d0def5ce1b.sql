-- ============================================================
-- FASE 1: Catálogo "Laudos e Serviços" + Faixas de Vida
-- ============================================================

-- 1) CATÁLOGO LAUDOS E SERVIÇOS
CREATE TABLE IF NOT EXISTS public.catalog_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  area text NOT NULL CHECK (area IN ('SAUDE','SEGURANCA','AMBOS')),
  service_type text NOT NULL CHECK (service_type IN ('AVULSO','RECORRENTE')),
  package_eligible boolean NOT NULL DEFAULT true,
  description text,
  validity_months integer,
  delivery_days integer,
  reference_value numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_services_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_catalog_services_category ON public.catalog_services(category);
CREATE INDEX IF NOT EXISTS idx_catalog_services_active ON public.catalog_services(is_active);

-- Normalizar nome para UPPERCASE
CREATE OR REPLACE FUNCTION public.normalize_catalog_service_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.name := upper(trim(NEW.name));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalog_services_normalize ON public.catalog_services;
CREATE TRIGGER trg_catalog_services_normalize
BEFORE INSERT OR UPDATE ON public.catalog_services
FOR EACH ROW EXECUTE FUNCTION public.normalize_catalog_service_name();

ALTER TABLE public.catalog_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catalog_services"
  ON public.catalog_services FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "ADM Master can insert catalog_services"
  ON public.catalog_services FOR INSERT
  TO authenticated WITH CHECK (is_adm_master());

CREATE POLICY "ADM Master can update catalog_services"
  ON public.catalog_services FOR UPDATE
  TO authenticated USING (is_adm_master());

CREATE POLICY "ADM Master can delete catalog_services"
  ON public.catalog_services FOR DELETE
  TO authenticated USING (is_adm_master());

-- 2) COMPOSIÇÃO DE PACOTES (preparação)
CREATE TABLE IF NOT EXISTS public.catalog_service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catalog_services(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.catalog_services(id) ON DELETE RESTRICT,
  item_type text NOT NULL DEFAULT 'NOVO' CHECK (item_type IN ('NOVO','REVISAO','RENOVACAO','OUTRO')),
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_value numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, service_id, item_type)
);

ALTER TABLE public.catalog_service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catalog_service_packages"
  ON public.catalog_service_packages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "ADM Master can manage catalog_service_packages"
  ON public.catalog_service_packages FOR ALL
  TO authenticated USING (is_adm_master()) WITH CHECK (is_adm_master());

-- 3) FAIXAS DE VIDA (CRUD ADM Master)
CREATE TABLE IF NOT EXISTS public.life_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  min_lives integer NOT NULL CHECK (min_lives >= 0),
  max_lives integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_lives IS NULL OR max_lives >= min_lives)
);

CREATE INDEX IF NOT EXISTS idx_life_ranges_min ON public.life_ranges(min_lives);

-- Validação: impedir sobreposição entre faixas ativas
CREATE OR REPLACE FUNCTION public.validate_life_range_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT NEW.is_active THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.life_ranges lr
    WHERE lr.is_active = true
      AND lr.id <> COALESCE(NEW.id, gen_random_uuid())
      AND (
        (NEW.max_lives IS NULL AND lr.max_lives IS NULL)
        OR (NEW.max_lives IS NULL AND lr.max_lives >= NEW.min_lives)
        OR (lr.max_lives IS NULL AND NEW.max_lives >= lr.min_lives)
        OR (NEW.min_lives <= lr.max_lives AND NEW.max_lives >= lr.min_lives)
      )
  ) THEN
    RAISE EXCEPTION 'Faixa sobrepõe outra faixa ativa.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_life_ranges_overlap ON public.life_ranges;
CREATE TRIGGER trg_life_ranges_overlap
BEFORE INSERT OR UPDATE ON public.life_ranges
FOR EACH ROW EXECUTE FUNCTION public.validate_life_range_overlap();

ALTER TABLE public.life_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view life_ranges"
  ON public.life_ranges FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "ADM Master can manage life_ranges"
  ON public.life_ranges FOR ALL
  TO authenticated USING (is_adm_master()) WITH CHECK (is_adm_master());

-- Seed inicial
INSERT INTO public.life_ranges (label, min_lives, max_lives, sort_order) VALUES
  ('1-5', 1, 5, 1),
  ('6-10', 6, 10, 2),
  ('11-20', 11, 20, 3),
  ('21-50', 21, 50, 4),
  ('51-100', 51, 100, 5),
  ('101-200', 101, 200, 6),
  ('201-500', 201, 500, 7),
  ('500+', 501, NULL, 8)
ON CONFLICT DO NOTHING;

-- 4) LIMPAR DADOS DE RENOVAÇÃO (recomeçar) e ajustar schema
DELETE FROM public.renewal_quotation_items;
DELETE FROM public.renewal_quotations;

-- Adicionar colunas necessárias para a nova memória de cálculo
ALTER TABLE public.renewal_quotation_items
  ADD COLUMN IF NOT EXISTS catalog_service_id uuid REFERENCES public.catalog_services(id),
  ADD COLUMN IF NOT EXISTS quantity numeric(12,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reference_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS comparison_status text CHECK (comparison_status IN ('ACIMA','IGUAL','ABAIXO'));

-- Trigger updated_at em catalog_services já está em normalize. Adicionar para life_ranges via overlap trigger.