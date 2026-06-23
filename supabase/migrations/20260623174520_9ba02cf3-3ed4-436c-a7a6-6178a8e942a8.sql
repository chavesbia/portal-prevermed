
-- 1) contract_placeholders: add 'fonte' (origin mapping) and 'formato' (formatting/extenso)
ALTER TABLE public.contract_placeholders
  ADD COLUMN IF NOT EXISTS fonte text,
  ADD COLUMN IF NOT EXISTS formato text NOT NULL DEFAULT 'texto';

COMMENT ON COLUMN public.contract_placeholders.fonte IS 'Mapeamento da origem do valor. Formatos: "cliente.<coluna>", "contrato.<coluna>", ou null (preenchimento manual no wizard).';
COMMENT ON COLUMN public.contract_placeholders.formato IS 'Formato de saída: texto, cnpj, cpf, cep, moeda, data, numero, percentual, extenso_numero, extenso_moeda, extenso_data.';

-- 2) contract_contratos: separar datas (mantém data_inicio como início da vigência)
ALTER TABLE public.contract_contratos
  ADD COLUMN IF NOT EXISTS data_emissao date,
  ADD COLUMN IF NOT EXISTS data_assinatura date;

COMMENT ON COLUMN public.contract_contratos.data_emissao IS 'Data de emissão do contrato (geração).';
COMMENT ON COLUMN public.contract_contratos.data_assinatura IS 'Data em que o contrato foi efetivamente assinado.';
COMMENT ON COLUMN public.contract_contratos.data_inicio IS 'Data de início da vigência contratual.';
