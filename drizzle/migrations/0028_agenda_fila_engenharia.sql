ALTER TABLE public.soc_agendamentos ADD COLUMN IF NOT EXISTS fila_aprovacao text NOT NULL DEFAULT 'saude';
ALTER TABLE public.soc_agendamentos ADD COLUMN IF NOT EXISTS estrutura_solicitada jsonb;
COMMENT ON COLUMN public.soc_agendamentos.fila_aprovacao IS 'saude = documentação clínica; engenharia = unidade/setor/cargo inexistente no SOC (trava técnica)';