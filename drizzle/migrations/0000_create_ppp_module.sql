CREATE TABLE public.ppp_solicitacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    solicitante_nome text NOT NULL,
    funcionario_nome text NOT NULL,
    funcionario_cpf text NOT NULL,
    numero text,
    observacao text,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    realizado boolean NOT NULL DEFAULT false,
    realizado_por_user_id uuid,
    realizado_por_nome text,
    realizado_em timestamptz,
    valor_calculado numeric
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_solicitacoes TO authenticated;
GRANT ALL ON public.ppp_solicitacoes TO service_role;

ALTER TABLE public.ppp_solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select PPP" ON public.ppp_solicitacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert PPP" ON public.ppp_solicitacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update PPP" ON public.ppp_solicitacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ADM Master can delete PPP" ON public.ppp_solicitacoes FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE TABLE public.ppp_periodos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id uuid REFERENCES public.ppp_solicitacoes(id) ON DELETE CASCADE NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_periodos TO authenticated;
GRANT ALL ON public.ppp_periodos TO service_role;

ALTER TABLE public.ppp_periodos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select PPP periods" ON public.ppp_periodos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert PPP periods" ON public.ppp_periodos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update PPP periods" ON public.ppp_periodos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "PPP editors can delete periods" ON public.ppp_periodos FOR DELETE TO authenticated USING (public.is_adm_master() OR EXISTS (SELECT 1 FROM public.ppp_solicitacoes s WHERE s.id = ppp_periodos.solicitacao_id AND s.realizado = false));

CREATE TABLE public.ppp_anexos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id uuid REFERENCES public.ppp_solicitacoes(id) ON DELETE CASCADE NOT NULL,
    tipo_documento text NOT NULL,
    arquivo_url text NOT NULL,
    nome_arquivo text NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_anexos TO authenticated;
GRANT ALL ON public.ppp_anexos TO service_role;

ALTER TABLE public.ppp_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select PPP attachments" ON public.ppp_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert PPP attachments" ON public.ppp_anexos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update PPP attachments" ON public.ppp_anexos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ADM Master can delete PPP attachments" ON public.ppp_anexos FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE OR REPLACE FUNCTION public.ppp_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ano text := to_char(COALESCE(NEW.created_at, now()), 'YYYY');
  v_next integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT COALESCE(MAX(CAST(split_part(numero, '-', 3) AS integer)), 0) + 1
      INTO v_next
      FROM public.ppp_solicitacoes
     WHERE split_part(numero, '-', 2) = v_ano
       AND split_part(numero, '-', 3) ~ '^[0-9]+$';
    NEW.numero := 'PPP-' || v_ano || '-' || lpad(v_next::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ppp_set_numero
BEFORE INSERT ON public.ppp_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.ppp_set_numero();

CREATE UNIQUE INDEX ppp_solicitacoes_numero_key ON public.ppp_solicitacoes (numero);