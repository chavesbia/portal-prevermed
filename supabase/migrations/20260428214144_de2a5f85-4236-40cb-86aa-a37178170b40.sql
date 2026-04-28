-- Renovações contratuais
CREATE TABLE public.renewal_quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  renewal_number TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  client_id UUID REFERENCES public.commercial_clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  current_lives INTEGER NOT NULL DEFAULT 0,
  index_type TEXT NOT NULL DEFAULT 'IGPM',
  index_percent NUMERIC NOT NULL DEFAULT 0,
  reference_period TEXT,
  current_total_monthly NUMERIC NOT NULL DEFAULT 0,
  current_total_annual NUMERIC NOT NULL DEFAULT 0,
  adjusted_total_monthly NUMERIC NOT NULL DEFAULT 0,
  adjusted_total_annual NUMERIC NOT NULL DEFAULT 0,
  reference_total_monthly NUMERIC NOT NULL DEFAULT 0,
  deviation_percent NUMERIC NOT NULL DEFAULT 0,
  deviation_status TEXT NOT NULL DEFAULT 'igual',
  justification TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando_aprovacao',
  rejection_reason TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.renewal_quotation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  renewal_id UUID NOT NULL REFERENCES public.renewal_quotations(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.commercial_services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  applied_percent NUMERIC NOT NULL DEFAULT 0,
  adjusted_value NUMERIC NOT NULL DEFAULT 0,
  reference_value NUMERIC NOT NULL DEFAULT 0,
  is_included BOOLEAN NOT NULL DEFAULT true,
  observation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_renewal_quotations_client ON public.renewal_quotations(client_id);
CREATE INDEX idx_renewal_quotations_status ON public.renewal_quotations(status);
CREATE INDEX idx_renewal_quotation_items_renewal ON public.renewal_quotation_items(renewal_id);

ALTER TABLE public.renewal_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_quotation_items ENABLE ROW LEVEL SECURITY;

-- RLS renewal_quotations
CREATE POLICY "Authenticated can view renewal_quotations"
  ON public.renewal_quotations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert renewal_quotations"
  ON public.renewal_quotations FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR can_edit_module_route(auth.uid(), '/precificacao'));

CREATE POLICY "Admins can update renewal_quotations"
  ON public.renewal_quotations FOR UPDATE TO authenticated
  USING (is_admin() OR can_edit_module_route(auth.uid(), '/precificacao'));

CREATE POLICY "ADM Master can delete renewal_quotations"
  ON public.renewal_quotations FOR DELETE TO authenticated USING (is_adm_master());

-- RLS items
CREATE POLICY "Authenticated can view renewal_quotation_items"
  ON public.renewal_quotation_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert renewal_quotation_items"
  ON public.renewal_quotation_items FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR can_edit_module_route(auth.uid(), '/precificacao'));

CREATE POLICY "Admins can update renewal_quotation_items"
  ON public.renewal_quotation_items FOR UPDATE TO authenticated
  USING (is_admin() OR can_edit_module_route(auth.uid(), '/precificacao'));

CREATE POLICY "Admins can delete renewal_quotation_items"
  ON public.renewal_quotation_items FOR DELETE TO authenticated
  USING (is_admin() OR can_edit_module_route(auth.uid(), '/precificacao'));

-- Numeração automática REN-AAAA-NNNN
CREATE OR REPLACE FUNCTION public.set_renewal_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr TEXT := to_char(now(), 'YYYY');
  next_seq INTEGER;
BEGIN
  IF NEW.renewal_number IS NULL OR NEW.renewal_number = '' THEN
    SELECT COALESCE(MAX(CAST(split_part(renewal_number, '-', 3) AS INTEGER)), 0) + 1
      INTO next_seq
      FROM public.renewal_quotations
      WHERE renewal_number LIKE 'REN-' || yr || '-%';
    NEW.renewal_number := 'REN-' || yr || '-' || lpad(next_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_renewal_number
  BEFORE INSERT ON public.renewal_quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_renewal_number();

CREATE TRIGGER trg_renewal_quotations_updated_at
  BEFORE UPDATE ON public.renewal_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();