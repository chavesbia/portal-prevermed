ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS pode_ser_executor boolean NOT NULL DEFAULT false;

UPDATE public.profissionais p
SET pode_ser_executor = true
WHERE p.categoria IN ('Técnico(a) de Segurança do Trabalho','Engenheiro(a) de Segurança do Trabalho','Auxiliar Técnico')
   OR EXISTS (SELECT 1 FROM public.servicos_os s WHERE s.responsavel_id = p.id)
   OR EXISTS (SELECT 1 FROM public.os_visitas v WHERE v.responsavel_id = p.id);