
ALTER TABLE public.commercial_clients
  ADD COLUMN revisado boolean NOT NULL DEFAULT false,
  ADD COLUMN revisado_em timestamptz,
  ADD COLUMN revisado_por uuid;
