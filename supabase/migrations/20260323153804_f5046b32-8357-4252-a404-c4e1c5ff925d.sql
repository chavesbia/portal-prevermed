
-- Add sla_final column to guia_gestao to freeze SLA when atendimento is lançado
ALTER TABLE public.guia_gestao ADD COLUMN IF NOT EXISTS sla_final text DEFAULT NULL;

-- Update existing REMARCADO values to NAO_INFORMADO
UPDATE public.guia_gestao SET compareceu_status = 'NAO_INFORMADO' WHERE compareceu_status = 'REMARCADO';
