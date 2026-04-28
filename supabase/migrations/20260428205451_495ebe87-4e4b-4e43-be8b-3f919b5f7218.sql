-- 1) Normalizar categorias existentes para UPPERCASE (evitar duplicatas tipo "LAUDOS" vs "Laudos")
UPDATE public.commercial_services
SET category = UPPER(TRIM(category))
WHERE category IS NOT NULL AND category <> UPPER(TRIM(category));

-- 2) Adicionar flag de pacote
ALTER TABLE public.commercial_services
  ADD COLUMN IF NOT EXISTS is_package boolean NOT NULL DEFAULT false;

-- 3) Componentes padrão de um pacote (quais serviços compõem o pacote por padrão)
CREATE TABLE IF NOT EXISTS public.commercial_service_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.commercial_services(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.commercial_services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (package_id, component_id),
  CHECK (package_id <> component_id)
);

ALTER TABLE public.commercial_service_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service_components"
  ON public.commercial_service_components FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert service_components"
  ON public.commercial_service_components FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can update service_components"
  ON public.commercial_service_components FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete service_components"
  ON public.commercial_service_components FOR DELETE
  TO authenticated USING (is_admin());

-- 4) Módulos ativos de um pacote por cliente (customização por cliente)
CREATE TABLE IF NOT EXISTS public.commercial_client_service_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.commercial_clients(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.commercial_services(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.commercial_services(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (client_id, package_id, component_id)
);

ALTER TABLE public.commercial_client_service_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view client_service_modules"
  ON public.commercial_client_service_modules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert client_service_modules"
  ON public.commercial_client_service_modules FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can update client_service_modules"
  ON public.commercial_client_service_modules FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete client_service_modules"
  ON public.commercial_client_service_modules FOR DELETE
  TO authenticated USING (is_admin());

-- 5) Trigger updated_at
CREATE TRIGGER trg_client_service_modules_updated
  BEFORE UPDATE ON public.commercial_client_service_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Índices
CREATE INDEX IF NOT EXISTS idx_service_components_package ON public.commercial_service_components(package_id);
CREATE INDEX IF NOT EXISTS idx_client_service_modules_client ON public.commercial_client_service_modules(client_id);
CREATE INDEX IF NOT EXISTS idx_client_service_modules_package ON public.commercial_client_service_modules(client_id, package_id);