
CREATE TYPE public.os_custo_tipo AS ENUM (
  'profissional_externo','art','deslocamento','locacao_equipamento','hospedagem','alimentacao','outros'
);

CREATE TABLE public.os_custos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  servico_os_id UUID REFERENCES public.servicos_os(id) ON DELETE SET NULL,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  tipo public.os_custo_tipo NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  fornecedor TEXT,
  anexo_url TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_os_custos_ordem ON public.os_custos(ordem_id);
CREATE INDEX idx_os_custos_servico ON public.os_custos(servico_os_id);
CREATE INDEX idx_os_custos_tipo ON public.os_custos(tipo);
CREATE INDEX idx_os_custos_data ON public.os_custos(data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_custos TO authenticated;
GRANT ALL ON public.os_custos TO service_role;

ALTER TABLE public.os_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_custos_select" ON public.os_custos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "os_custos_insert" ON public.os_custos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "os_custos_update" ON public.os_custos
  FOR UPDATE TO authenticated
  USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'))
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "os_custos_delete" ON public.os_custos
  FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE TRIGGER update_os_custos_updated_at
  BEFORE UPDATE ON public.os_custos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.os_custos_padrao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_servico TEXT,
  tipo public.os_custo_tipo NOT NULL,
  descricao TEXT NOT NULL,
  valor_sugerido NUMERIC(12,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_custos_padrao TO authenticated;
GRANT ALL ON public.os_custos_padrao TO service_role;

ALTER TABLE public.os_custos_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_custos_padrao_select" ON public.os_custos_padrao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "os_custos_padrao_write" ON public.os_custos_padrao
  FOR ALL TO authenticated
  USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE TRIGGER update_os_custos_padrao_updated_at
  BEFORE UPDATE ON public.os_custos_padrao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.historico_custo_os()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_name TEXT;
BEGIN
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historico_os(ordem_id, user_id, user_name, acao, comentario)
    VALUES (NEW.ordem_id, auth.uid(), COALESCE(v_user_name,'Sistema'),
            'Custo adicionado',
            NEW.tipo::text || ' — ' || NEW.descricao || ' (R$ ' || NEW.valor::text || ')');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.historico_os(ordem_id, user_id, user_name, acao, comentario)
    VALUES (OLD.ordem_id, auth.uid(), COALESCE(v_user_name,'Sistema'),
            'Custo removido',
            OLD.tipo::text || ' — ' || OLD.descricao);
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_historico_custo_os
  AFTER INSERT OR DELETE ON public.os_custos
  FOR EACH ROW EXECUTE FUNCTION public.historico_custo_os();
