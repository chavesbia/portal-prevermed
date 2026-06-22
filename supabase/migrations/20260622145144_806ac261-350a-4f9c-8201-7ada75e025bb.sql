
-- Garante user_id obrigatório (não existem órfãos)
ALTER TABLE public.fb_colaboradores ALTER COLUMN user_id SET NOT NULL;

-- Garante unique de user_id (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fb_colaboradores_user_id_key') THEN
    ALTER TABLE public.fb_colaboradores ADD CONSTRAINT fb_colaboradores_user_id_key UNIQUE (user_id);
  END IF;
END $$;
