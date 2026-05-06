-- 1) Coluna is_lotacao
ALTER TABLE public.user_departments
  ADD COLUMN IF NOT EXISTS is_lotacao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_departments.is_lotacao IS
  'Quando true, o vínculo é apenas organizacional (organograma/diretório) e não concede acesso funcional aos módulos do departamento.';

-- 2) Índice para filtros
CREATE INDEX IF NOT EXISTS idx_user_departments_is_lotacao
  ON public.user_departments (is_lotacao);

-- 3) Auto-marcação: departamentos sem módulos -> só fazem sentido como lotação
UPDATE public.user_departments ud
SET is_lotacao = true
WHERE NOT EXISTS (
  SELECT 1 FROM public.department_modules dm
  WHERE dm.department_id = ud.department_id
);