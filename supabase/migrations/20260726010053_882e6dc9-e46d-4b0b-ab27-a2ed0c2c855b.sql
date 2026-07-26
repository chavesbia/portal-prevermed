CREATE TABLE public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  soc_contact_code text NOT NULL,
  nome text,
  telefone_1 text,
  ramal_1 text,
  telefone_2 text,
  ramal_2 text,
  email_1 text,
  email_2 text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_contacts TO authenticated;
GRANT ALL ON public.company_contacts TO service_role;

ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_contacts_view ON public.company_contacts FOR SELECT
  USING (is_adm_master() OR can_view_module_route(auth.uid(), '/admin/empresas'::text));
CREATE POLICY company_contacts_insert ON public.company_contacts FOR INSERT
  WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'::text));
CREATE POLICY company_contacts_update ON public.company_contacts FOR UPDATE
  USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/admin/empresas'::text));
CREATE POLICY company_contacts_delete ON public.company_contacts FOR DELETE
  USING (is_adm_master());

CREATE UNIQUE INDEX company_contacts_company_code_uidx
  ON public.company_contacts (company_id, soc_contact_code);
CREATE INDEX company_contacts_company_idx ON public.company_contacts (company_id);

CREATE TRIGGER update_company_contacts_updated_at
  BEFORE UPDATE ON public.company_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();