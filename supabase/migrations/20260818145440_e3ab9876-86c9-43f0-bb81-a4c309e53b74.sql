BEGIN;
-- 1. Inserir Meirivan e Eliseu na tabela profissionais caso não existam, mantendo o mesmo ID do auth.users
-- Nota: A tabela profissionais pode não ter a coluna user_id ou email obrigatória, mas vamos preencher o que temos.
INSERT INTO public.profissionais (id, nome, email, categoria, ativo)
VALUES 
  ('1bb20a4f-c200-4f72-b772-602f7a4945c0', 'Meirivan Silva', 'meirivan.silva@prevermed.internal', 'Outro', true),
  ('d77e5153-9d19-45bb-bc61-6188ab314ba0', 'Eliseu Silva', 'elisei.silva@prevermed.internal', 'Outro', true)
ON CONFLICT (id) DO UPDATE SET 
  nome = EXCLUDED.nome,
  email = EXCLUDED.email;

-- 2. Alterar a constraint da tabela os_visitas
ALTER TABLE public.os_visitas DROP CONSTRAINT IF EXISTS os_visitas_responsavel_id_fkey;
ALTER TABLE public.os_visitas 
ADD CONSTRAINT os_visitas_responsavel_id_fkey 
FOREIGN KEY (responsavel_id) REFERENCES public.profissionais(id) ON DELETE SET NULL;

COMMIT;