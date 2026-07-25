ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.company_units(id) ON DELETE SET NULL;
ALTER TABLE public.laudos ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.company_units(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ordens_servico_unidade_id ON public.ordens_servico(unidade_id);
CREATE INDEX IF NOT EXISTS idx_laudos_unidade_id ON public.laudos(unidade_id);