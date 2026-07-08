
CREATE TABLE public.conselhos_classe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sigla TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conselhos_classe TO authenticated;
GRANT ALL ON public.conselhos_classe TO service_role;

ALTER TABLE public.conselhos_classe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver conselhos"
  ON public.conselhos_classe FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Editores de OS podem inserir conselhos"
  ON public.conselhos_classe FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "Editores de OS podem atualizar conselhos"
  ON public.conselhos_classe FOR UPDATE TO authenticated
  USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'))
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "Adm master pode excluir conselhos"
  ON public.conselhos_classe FOR DELETE TO authenticated
  USING (public.is_adm_master());

CREATE TRIGGER update_conselhos_classe_updated_at
  BEFORE UPDATE ON public.conselhos_classe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.conselhos_classe (sigla, descricao, is_default) VALUES
  ('CREA', 'Conselho Regional de Engenharia e Agronomia', true),
  ('CRF', 'Conselho Regional de Farmácia', true),
  ('CRM', 'Conselho Regional de Medicina', true),
  ('CRQ', 'Conselho Regional de Química', true),
  ('CREFITO', 'Conselho Regional de Fisioterapia e Terapia Ocupacional', true),
  ('COREN', 'Conselho Regional de Enfermagem', true),
  ('CRP', 'Conselho Regional de Psicologia', true),
  ('MTE', 'Ministério do Trabalho e Emprego (registro profissional)', true),
  ('OUTRO', 'Outro conselho / registro', true)
ON CONFLICT (sigla) DO NOTHING;
