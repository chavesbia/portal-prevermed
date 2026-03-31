
-- Create commercial_clients table
CREATE TABLE public.commercial_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  legal_name text,
  cnpj text,
  soc_code text,
  city text,
  state text DEFAULT 'SP',
  active_lives integer DEFAULT 0,
  subgroup text NOT NULL,
  risk_grade text NOT NULL,
  has_contract boolean DEFAULT false,
  contract_signed boolean DEFAULT false,
  contract_number text,
  contract_start_date date,
  contract_end_date date,
  proposal_approved boolean DEFAULT false,
  proposal_number text,
  approval_date date,
  services_summary text,
  pricing_table_attached boolean DEFAULT false,
  notes text,
  is_active boolean DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cnpj_or_soc_required CHECK (cnpj IS NOT NULL OR soc_code IS NOT NULL),
  CONSTRAINT contract_dates_valid CHECK (contract_end_date IS NULL OR contract_start_date IS NULL OR contract_end_date >= contract_start_date)
);

-- Unique indexes for dedup
CREATE UNIQUE INDEX idx_commercial_clients_cnpj ON public.commercial_clients (cnpj) WHERE cnpj IS NOT NULL;
CREATE UNIQUE INDEX idx_commercial_clients_soc_code ON public.commercial_clients (soc_code) WHERE soc_code IS NOT NULL;

-- Create client_attachments table
CREATE TABLE public.client_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.commercial_clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('contrato', 'proposta', 'tabela')),
  file_url text NOT NULL,
  file_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_attachments_client_id ON public.client_attachments (client_id);

-- Enable RLS
ALTER TABLE public.commercial_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;

-- RLS for commercial_clients
CREATE POLICY "Authenticated users can view commercial_clients"
  ON public.commercial_clients FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert commercial_clients"
  ON public.commercial_clients FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update commercial_clients"
  ON public.commercial_clients FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete commercial_clients"
  ON public.commercial_clients FOR DELETE TO authenticated
  USING (is_adm_master());

-- RLS for client_attachments
CREATE POLICY "Authenticated users can view client_attachments"
  ON public.client_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert client_attachments"
  ON public.client_attachments FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete client_attachments"
  ON public.client_attachments FOR DELETE TO authenticated
  USING (is_admin());

-- Storage bucket for client documents
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', true);

-- Storage policies
CREATE POLICY "Authenticated users can view client documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents');

CREATE POLICY "Admins can upload client documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND is_admin());

CREATE POLICY "Admins can delete client documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND is_admin());

-- Updated_at trigger
CREATE TRIGGER update_commercial_clients_updated_at
  BEFORE UPDATE ON public.commercial_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
