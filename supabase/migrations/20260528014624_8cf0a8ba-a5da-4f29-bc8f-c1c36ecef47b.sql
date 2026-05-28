ALTER TABLE public.aso_exames_atendimento
  ADD COLUMN IF NOT EXISTS nova_coleta_canal_contato text,
  ADD COLUMN IF NOT EXISTS nova_coleta_contato_rh text,
  ADD COLUMN IF NOT EXISTS nova_coleta_data_convocacao date,
  ADD COLUMN IF NOT EXISTS nova_coleta_observacoes_convocacao text;