
-- Responsáveis Técnicos
CREATE TABLE public.responsaveis_tecnicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  conselho TEXT NOT NULL DEFAULT 'CREA',
  numero_registro TEXT NOT NULL,
  especialidade TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.responsaveis_tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view responsaveis_tecnicos"
  ON public.responsaveis_tecnicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert responsaveis_tecnicos"
  ON public.responsaveis_tecnicos FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update responsaveis_tecnicos"
  ON public.responsaveis_tecnicos FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete responsaveis_tecnicos"
  ON public.responsaveis_tecnicos FOR DELETE TO authenticated USING (is_adm_master());

CREATE TRIGGER update_responsaveis_tecnicos_updated_at
  BEFORE UPDATE ON public.responsaveis_tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tipos de Laudo
CREATE TABLE public.tipos_laudo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  exige_vigencia BOOLEAN NOT NULL DEFAULT true,
  conselhos_permitidos TEXT[] NOT NULL DEFAULT '{CREA}',
  prazo_vigencia_padrao INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_laudo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tipos_laudo"
  ON public.tipos_laudo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert tipos_laudo"
  ON public.tipos_laudo FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update tipos_laudo"
  ON public.tipos_laudo FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete tipos_laudo"
  ON public.tipos_laudo FOR DELETE TO authenticated USING (is_adm_master());

CREATE TRIGGER update_tipos_laudo_updated_at
  BEFORE UPDATE ON public.tipos_laudo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Laudos
CREATE TABLE public.laudos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos_os(id) ON DELETE CASCADE,
  tipo_laudo_id UUID NOT NULL REFERENCES public.tipos_laudo(id),
  responsavel_tecnico_id UUID NOT NULL REFERENCES public.responsaveis_tecnicos(id),
  numero_os TEXT NOT NULL,
  empresa_cliente TEXT NOT NULL,
  tipo_servico TEXT NOT NULL,
  tipo_laudo_nome TEXT NOT NULL,
  responsavel_tecnico_nome TEXT NOT NULL,
  responsavel_tecnico_registro TEXT NOT NULL,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  possui_vigencia BOOLEAN NOT NULL DEFAULT true,
  data_validade DATE,
  justificativa_sem_vigencia TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.laudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view laudos"
  ON public.laudos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert laudos"
  ON public.laudos FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update laudos"
  ON public.laudos FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete laudos"
  ON public.laudos FOR DELETE TO authenticated USING (is_adm_master());

CREATE TRIGGER update_laudos_updated_at
  BEFORE UPDATE ON public.laudos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Configuração de Alertas
CREATE TABLE public.configuracao_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_laudo_id UUID REFERENCES public.tipos_laudo(id) ON DELETE CASCADE,
  dias_antecedencia INTEGER[] NOT NULL DEFAULT '{90,60,30}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracao_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view configuracao_alertas"
  ON public.configuracao_alertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert configuracao_alertas"
  ON public.configuracao_alertas FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update configuracao_alertas"
  ON public.configuracao_alertas FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete configuracao_alertas"
  ON public.configuracao_alertas FOR DELETE TO authenticated USING (is_adm_master());

CREATE TRIGGER update_configuracao_alertas_updated_at
  BEFORE UPDATE ON public.configuracao_alertas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial alert config (global)
INSERT INTO public.configuracao_alertas (dias_antecedencia, ativo) VALUES ('{90,60,30}', true);
