-- Adicionar campos de contato em commercial_clients
ALTER TABLE public.commercial_clients
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_whatsapp text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Catálogo mestre de serviços contratáveis (configurações)
CREATE TABLE IF NOT EXISTS public.commercial_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  category text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_services_name_unique
  ON public.commercial_services (lower(name));

ALTER TABLE public.commercial_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view commercial_services"
  ON public.commercial_services FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert commercial_services"
  ON public.commercial_services FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can update commercial_services"
  ON public.commercial_services FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY "ADM Master can delete commercial_services"
  ON public.commercial_services FOR DELETE
  TO authenticated USING (is_adm_master());

CREATE TRIGGER trg_commercial_services_updated
  BEFORE UPDATE ON public.commercial_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de junção: serviços contratados por cliente
CREATE TABLE IF NOT EXISTS public.commercial_client_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.commercial_clients(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.commercial_services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (client_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_ccs_client ON public.commercial_client_services(client_id);
CREATE INDEX IF NOT EXISTS idx_ccs_service ON public.commercial_client_services(service_id);

ALTER TABLE public.commercial_client_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view client_services"
  ON public.commercial_client_services FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert client_services"
  ON public.commercial_client_services FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can delete client_services"
  ON public.commercial_client_services FOR DELETE
  TO authenticated USING (is_admin());

-- Seed inicial de serviços comuns (SOC-like)
INSERT INTO public.commercial_services (name, category) VALUES
  ('ASO - Atestado de Saúde Ocupacional', 'Saúde Ocupacional'),
  ('PCMSO - Programa de Controle Médico', 'Saúde Ocupacional'),
  ('PGR - Programa de Gerenciamento de Riscos', 'Segurança do Trabalho'),
  ('LTCAT - Laudo Técnico das Condições Ambientais', 'Segurança do Trabalho'),
  ('Audiometria', 'Exames Complementares'),
  ('Espirometria', 'Exames Complementares'),
  ('Acuidade Visual', 'Exames Complementares'),
  ('Eletrocardiograma (ECG)', 'Exames Complementares'),
  ('Eletroencefalograma (EEG)', 'Exames Complementares'),
  ('Raio-X Tórax', 'Exames Complementares'),
  ('Hemograma Completo', 'Laboratoriais'),
  ('Glicemia', 'Laboratoriais'),
  ('Treinamento NR-35 (Trabalho em Altura)', 'Treinamentos NR'),
  ('Treinamento NR-10 (Eletricidade)', 'Treinamentos NR'),
  ('Treinamento NR-33 (Espaço Confinado)', 'Treinamentos NR'),
  ('Treinamento NR-06 (EPI)', 'Treinamentos NR'),
  ('CIPA - Comissão Interna de Prevenção', 'Segurança do Trabalho'),
  ('Laudo de Insalubridade', 'Laudos'),
  ('Laudo de Periculosidade', 'Laudos'),
  ('Visita Técnica In Loco', 'Atendimento')
ON CONFLICT DO NOTHING;