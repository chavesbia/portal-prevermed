
-- Remove duplicatas de aso_exames_atendimento mantendo o registro mais antigo
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY atendimento_id, nome_exame, tipo
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.aso_exames_atendimento
)
DELETE FROM public.aso_exames_atendimento
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Previne novas duplicatas
ALTER TABLE public.aso_exames_atendimento
  ADD CONSTRAINT aso_exames_atendimento_unique_exam
  UNIQUE (atendimento_id, nome_exame, tipo);
