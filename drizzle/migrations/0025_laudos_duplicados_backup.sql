CREATE TABLE IF NOT EXISTS public.laudos_duplicados_removidos (LIKE public.laudos);
ALTER TABLE public.laudos_duplicados_removidos ADD COLUMN IF NOT EXISTS removido_em timestamptz NOT NULL DEFAULT now();
GRANT SELECT ON public.laudos_duplicados_removidos TO authenticated;
GRANT ALL ON public.laudos_duplicados_removidos TO service_role;
ALTER TABLE public.laudos_duplicados_removidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adm master le backup laudos" ON public.laudos_duplicados_removidos FOR SELECT TO authenticated USING (public.is_adm_master());