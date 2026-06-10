
-- Enum Modelo Contratual
DO $$ BEGIN
  CREATE TYPE public.modelo_contratual AS ENUM ('Gestão Ocupacional', 'Parceira', 'Por Uso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela commercial_contracts
CREATE TABLE IF NOT EXISTS public.commercial_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.commercial_clients(id) ON DELETE CASCADE,
  contract_number TEXT,
  proposal_number TEXT,
  prospect_status TEXT,
  modelo_contratual public.modelo_contratual,
  contract_year INTEGER,
  start_date DATE,
  end_date DATE,
  signed BOOLEAN NOT NULL DEFAULT false,
  auto_renewal BOOLEAN NOT NULL DEFAULT false,
  renewal_term_months INTEGER,
  has_exam_table BOOLEAN NOT NULL DEFAULT false,
  has_service_table BOOLEAN NOT NULL DEFAULT false,
  is_current BOOLEAN NOT NULL DEFAULT false,
  status_derivado TEXT,
  revisao_pendente BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_contracts TO authenticated;
GRANT ALL ON public.commercial_contracts TO service_role;

ALTER TABLE public.commercial_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_select" ON public.commercial_contracts
  FOR SELECT TO authenticated
  USING (public.can_view_module_route(auth.uid(), '/carteira-comercial'));

CREATE POLICY "contracts_insert" ON public.commercial_contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.can_view_module_route(auth.uid(), '/carteira-comercial'));

CREATE POLICY "contracts_update" ON public.commercial_contracts
  FOR UPDATE TO authenticated
  USING (public.can_view_module_route(auth.uid(), '/carteira-comercial'))
  WITH CHECK (public.can_view_module_route(auth.uid(), '/carteira-comercial'));

CREATE POLICY "contracts_delete" ON public.commercial_contracts
  FOR DELETE TO authenticated
  USING (public.can_view_module_route(auth.uid(), '/carteira-comercial'));

-- Garantir 1 contrato vigente por cliente
CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_current_per_client
  ON public.commercial_contracts(client_id) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_contracts_client ON public.commercial_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.commercial_contracts(end_date);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.commercial_contracts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON public.commercial_contracts;
CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.commercial_contracts
  FOR EACH ROW EXECUTE FUNCTION public.commercial_contracts_set_updated_at();

-- Anexos vinculados opcionalmente a um contrato específico
ALTER TABLE public.client_attachments
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.commercial_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_attachments_contract ON public.client_attachments(contract_id);

-- Backfill: cria contrato inicial a partir dos campos embutidos em commercial_clients
INSERT INTO public.commercial_contracts (
  client_id, contract_number, proposal_number, start_date, end_date,
  signed, is_current, status_derivado, notes
)
SELECT
  c.id,
  c.contract_number,
  c.proposal_number,
  c.contract_start_date,
  c.contract_end_date,
  COALESCE(c.contract_signed, false),
  CASE WHEN c.contract_end_date IS NULL OR c.contract_end_date >= CURRENT_DATE THEN true ELSE false END,
  CASE
    WHEN c.contract_end_date IS NOT NULL AND c.contract_end_date < CURRENT_DATE THEN 'Vencido'
    WHEN c.contract_signed THEN 'Vigente'
    ELSE 'Aguardando assinatura'
  END,
  c.contract_notes
FROM public.commercial_clients c
WHERE c.has_contract = true
  AND NOT EXISTS (SELECT 1 FROM public.commercial_contracts cc WHERE cc.client_id = c.id);
