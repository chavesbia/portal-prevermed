ALTER TYPE public.contract_signer_type ADD VALUE IF NOT EXISTS 'contratada';

ALTER TABLE public.contract_contratos
  ADD COLUMN IF NOT EXISTS rep_email TEXT,
  ADD COLUMN IF NOT EXISTS testemunha1_email TEXT,
  ADD COLUMN IF NOT EXISTS testemunha2_email TEXT,
  ADD COLUMN IF NOT EXISTS prevermed_nome TEXT,
  ADD COLUMN IF NOT EXISTS prevermed_cpf TEXT,
  ADD COLUMN IF NOT EXISTS prevermed_email TEXT;
