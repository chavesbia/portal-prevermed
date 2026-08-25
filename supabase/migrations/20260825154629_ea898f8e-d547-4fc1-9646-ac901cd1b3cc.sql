CREATE TABLE public.contract_modalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_modalidades TO authenticated;
GRANT ALL ON public.contract_modalidades TO service_role;

ALTER TABLE public.contract_modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver modalidades"
ON public.contract_modalidades FOR SELECT TO authenticated USING (true);

CREATE POLICY "ADM Master pode criar modalidades"
ON public.contract_modalidades FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());

CREATE POLICY "ADM Master pode editar modalidades"
ON public.contract_modalidades FOR UPDATE TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE POLICY "ADM Master pode excluir modalidades"
ON public.contract_modalidades FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE TRIGGER update_contract_modalidades_updated_at
BEFORE UPDATE ON public.contract_modalidades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contract_contratos
  ADD COLUMN modalidade_id uuid REFERENCES public.contract_modalidades(id) ON DELETE RESTRICT;

INSERT INTO public.contract_modalidades (nome) VALUES
  ('Gestão Ocupacional'),
  ('Gestão Ocupacional com eSocial'),
  ('Por Uso'),
  ('Por Uso com eSocial'),
  ('Pontual'),
  ('Parceria');