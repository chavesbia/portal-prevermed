ALTER TABLE public.laudos
  ADD COLUMN IF NOT EXISTS possui_art boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS art_numero text,
  ADD COLUMN IF NOT EXISTS art_validade date,
  ADD COLUMN IF NOT EXISTS art_anexo_url text;