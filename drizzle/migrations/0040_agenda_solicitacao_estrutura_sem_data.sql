ALTER TABLE public.soc_agendamentos ALTER COLUMN data_agendada DROP NOT NULL;
ALTER TABLE public.soc_agendamentos ALTER COLUMN hora_agendada DROP NOT NULL;
COMMENT ON COLUMN public.soc_agendamentos.data_agendada IS 'Nulo apenas em solicitações de estrutura (fila engenharia), que não reservam data/horário.';