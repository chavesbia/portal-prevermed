-- Create enum for aguardando_aso field
CREATE TYPE public.aguardando_aso_status AS ENUM ('NAO_INFORMADO', 'CONTATO_REALIZADO', 'RECEBIDO', 'NAO_RECEBIDO');

-- Add column to guia_gestao
ALTER TABLE public.guia_gestao
ADD COLUMN aguardando_aso public.aguardando_aso_status NOT NULL DEFAULT 'NAO_INFORMADO'::aguardando_aso_status;