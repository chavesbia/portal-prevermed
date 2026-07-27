ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subgrupo text,
  ADD COLUMN IF NOT EXISTS vidas_ativas integer,
  ADD COLUMN IF NOT EXISTS classificacao_cliente text,
  ADD COLUMN IF NOT EXISTS cliente_inadimplente boolean,
  ADD COLUMN IF NOT EXISTS data_assinatura_contrato date,
  ADD COLUMN IF NOT EXISTS preco_synced_at timestamp with time zone;