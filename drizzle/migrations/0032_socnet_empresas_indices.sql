ALTER TABLE public.socnet_empresas ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.socnet_empresas ADD COLUMN IF NOT EXISTS sincronizado_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS socnet_empresas_cnpj_key ON public.socnet_empresas (cnpj);
GRANT ALL ON public.socnet_empresas TO service_role;
COMMENT ON TABLE public.socnet_empresas IS 'Catálogo técnico isolado (CNPJ -> código SOC) da rede SOCNET, usado só pela Agenda. Nunca misturar com companies.';