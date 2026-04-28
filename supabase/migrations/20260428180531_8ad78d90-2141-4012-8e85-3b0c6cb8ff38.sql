
ALTER TABLE public.os_equipamentos
  ADD COLUMN IF NOT EXISTS certificado text,
  ADD COLUMN IF NOT EXISTS is_locacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locacao_fornecedor text,
  ADD COLUMN IF NOT EXISTS locacao_cnpj text,
  ADD COLUMN IF NOT EXISTS locacao_nf_numero text,
  ADD COLUMN IF NOT EXISTS locacao_nf_data date,
  ADD COLUMN IF NOT EXISTS locacao_custo numeric(12,2);
