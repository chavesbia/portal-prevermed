CREATE TABLE public.whatsapp_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL UNIQUE,
  nome text,
  etapa text NOT NULL DEFAULT 'INICIO',
  dados_sessao jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_sessoes TO authenticated;
GRANT ALL ON public.whatsapp_sessoes TO service_role;
ALTER TABLE public.whatsapp_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adm_master vê sessões whatsapp" ON public.whatsapp_sessoes FOR SELECT TO authenticated USING (public.is_adm_master());
CREATE TRIGGER trg_whatsapp_sessoes_updated BEFORE UPDATE ON public.whatsapp_sessoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();