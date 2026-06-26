
-- Enum tipo signatário
DO $$ BEGIN
  CREATE TYPE public.contract_signatario_tipo AS ENUM ('responsavel_prevermed', 'testemunha');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.contract_signatarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.contract_signatario_tipo NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  email TEXT,
  cargo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_signatarios TO authenticated;
GRANT ALL ON public.contract_signatarios TO service_role;

ALTER TABLE public.contract_signatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read signatarios"
  ON public.contract_signatarios FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Adm master manages signatarios insert"
  ON public.contract_signatarios FOR INSERT
  TO authenticated WITH CHECK (public.is_adm_master());

CREATE POLICY "Adm master manages signatarios update"
  ON public.contract_signatarios FOR UPDATE
  TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE POLICY "Adm master manages signatarios delete"
  ON public.contract_signatarios FOR DELETE
  TO authenticated USING (public.is_adm_master());

CREATE TRIGGER trg_contract_signatarios_updated_at
  BEFORE UPDATE ON public.contract_signatarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Limpa placeholder com chave inválida (underscores extras)
DELETE FROM public.contract_placeholders WHERE chave = '__DIAS_BLOQUEIO_EXTENSO__';

-- Garante placeholder padrão DIAS_BLOQUEIO
INSERT INTO public.contract_placeholders (chave, label, descricao, grupo, ordem, formato, fonte, ativo)
SELECT 'DIAS_BLOQUEIO', 'Dias para bloqueio', 'Quantidade de dias após o vencimento para bloqueio do serviço', 'financeiro', 100, 'numero', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.contract_placeholders WHERE chave = 'DIAS_BLOQUEIO');
