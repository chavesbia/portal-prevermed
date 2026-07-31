ALTER TABLE public.profissionais DROP CONSTRAINT IF EXISTS profissionais_categoria_check;

UPDATE public.profissionais SET categoria = 'Médico(a)' WHERE categoria IN ('Médico','Médica');
UPDATE public.profissionais SET categoria = 'Engenheiro(a) de Segurança do Trabalho' WHERE categoria IN ('Engenheiro de Segurança','Engenheira de Segurança');
UPDATE public.profissionais SET categoria = 'Técnico(a) de Segurança do Trabalho' WHERE categoria IN ('Técnico de Segurança','Técnica de Segurança');
UPDATE public.profissionais SET categoria = 'Outro'
WHERE categoria NOT IN ('Médico(a)','Engenheiro(a) de Segurança do Trabalho','Técnico(a) de Segurança do Trabalho','Auxiliar Técnico','Outro');

ALTER TABLE public.profissionais
  ADD CONSTRAINT profissionais_categoria_check
  CHECK (categoria IN ('Médico(a)','Engenheiro(a) de Segurança do Trabalho','Técnico(a) de Segurança do Trabalho','Auxiliar Técnico','Outro'));

UPDATE public.conselhos_classe SET ativo = false, updated_at = now()
WHERE sigla IN ('CRF','CRQ','CREFITO','COREN','CRP');

INSERT INTO public.conselhos_classe (sigla, descricao, ativo, is_default)
SELECT 'CPF', 'Pessoa sem conselho de classe formal — identificação por CPF', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.conselhos_classe WHERE sigla = 'CPF');

UPDATE public.conselhos_classe SET ativo = true, updated_at = now() WHERE sigla IN ('CRM','CREA','MTE','OUTRO','CPF');