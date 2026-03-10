
-- =============================================
-- TABELA: services (catálogo de serviços para precificação)
-- =============================================
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'HORAS',
  unit_value NUMERIC NOT NULL DEFAULT 0,
  cost_value NUMERIC NOT NULL DEFAULT 0,
  min_quantity INTEGER NULL,
  default_markup NUMERIC NULL,
  category TEXT NOT NULL DEFAULT 'servico',
  info_text TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver serviços ativos
CREATE POLICY "Authenticated users can view active services"
  ON public.services FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

-- Apenas adm_master pode gerenciar serviços
CREATE POLICY "Admins can insert services"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (is_adm_master());

CREATE POLICY "Admins can update services"
  ON public.services FOR UPDATE
  TO authenticated
  USING (is_adm_master());

CREATE POLICY "Admins can delete services"
  ON public.services FOR DELETE
  TO authenticated
  USING (is_adm_master());

-- Trigger para updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: quotations (memórias de cálculo)
-- =============================================
CREATE TYPE public.quotation_status AS ENUM (
  'rascunho',
  'aguardando_aprovacao',
  'aprovado',
  'rejeitado'
);

CREATE TABLE public.quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_number TEXT NULL,
  client_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  custos_adicionais JSONB NOT NULL DEFAULT '{}'::jsonb,
  discount_percent NUMERIC NULL DEFAULT 0,
  discount_value NUMERIC NULL DEFAULT 0,
  total_value NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  total_result NUMERIC NOT NULL,
  margin_percent NUMERIC NOT NULL,
  notes TEXT NULL,
  status public.quotation_status NOT NULL DEFAULT 'aguardando_aprovacao',
  rejection_reason TEXT NULL,
  approved_by UUID NULL,
  approved_at TIMESTAMP WITH TIME ZONE NULL,
  created_by UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para quotations
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- Usuários com acesso ao módulo podem ver suas próprias cotações; admins veem tudo
CREATE POLICY "Users can view own quotations"
  ON public.quotations FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

-- Usuários com acesso ao módulo podem criar cotações
CREATE POLICY "Users can create quotations"
  ON public.quotations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Usuários podem atualizar suas próprias cotações; admins podem atualizar todas
CREATE POLICY "Users can update own quotations"
  ON public.quotations FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

-- Apenas adm_master pode deletar cotações
CREATE POLICY "Admins can delete quotations"
  ON public.quotations FOR DELETE
  TO authenticated
  USING (is_adm_master());

-- Trigger para updated_at
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: quotation_versions (histórico de versões)
-- =============================================
CREATE TABLE public.quotation_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  custos_adicionais JSONB NOT NULL DEFAULT '{}'::jsonb,
  discount_percent NUMERIC NULL DEFAULT 0,
  discount_value NUMERIC NULL DEFAULT 0,
  total_value NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  total_result NUMERIC NOT NULL,
  margin_percent NUMERIC NOT NULL,
  notes TEXT NULL,
  status TEXT NULL,
  rejection_reason TEXT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para quotation_versions
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

-- Mesma lógica de acesso das quotations
CREATE POLICY "Users can view versions of own quotations"
  ON public.quotation_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_versions.quotation_id
        AND (q.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "Users can insert versions"
  ON public.quotation_versions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR is_admin());

-- Versões são imutáveis: sem UPDATE ou DELETE para usuários comuns
CREATE POLICY "Admins can delete versions"
  ON public.quotation_versions FOR DELETE
  TO authenticated
  USING (is_adm_master());
