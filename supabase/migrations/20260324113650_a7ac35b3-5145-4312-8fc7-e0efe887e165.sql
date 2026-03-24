CREATE TABLE public.prestadores_bloqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_normalizado text NOT NULL,
  motivo text,
  bloqueado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(nome_normalizado)
);

ALTER TABLE public.prestadores_bloqueados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prestadores_bloqueados"
  ON public.prestadores_bloqueados FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert prestadores_bloqueados"
  ON public.prestadores_bloqueados FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can update prestadores_bloqueados"
  ON public.prestadores_bloqueados FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete prestadores_bloqueados"
  ON public.prestadores_bloqueados FOR DELETE
  TO authenticated USING (is_admin());