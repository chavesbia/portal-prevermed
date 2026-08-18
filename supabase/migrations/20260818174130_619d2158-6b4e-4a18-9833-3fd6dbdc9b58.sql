ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS contato_email text,
ADD COLUMN IF NOT EXISTS contato_telefone text;

GRANT SELECT, INSERT, UPDATE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;