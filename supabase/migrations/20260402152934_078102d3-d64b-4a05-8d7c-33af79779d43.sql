
-- Tabela principal de Ordens de Serviço
CREATE TABLE public.ordens_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_os TEXT NOT NULL,
  empresa_cliente TEXT NOT NULL,
  contato_cliente TEXT,
  responsavel_atual TEXT NOT NULL,
  status_os TEXT NOT NULL DEFAULT 'Não iniciado',
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  data_emissao DATE,
  prazo_acordado DATE,
  observacoes TEXT,
  tipo_servico_resumo TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ordens_servico"
  ON public.ordens_servico FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert ordens_servico"
  ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update ordens_servico"
  ON public.ordens_servico FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete ordens_servico"
  ON public.ordens_servico FOR DELETE TO authenticated
  USING (is_adm_master());

CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de serviços individuais dentro de cada OS
CREATE TABLE public.servicos_os (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  tipo_os TEXT NOT NULL DEFAULT 'Novo',
  status TEXT NOT NULL DEFAULT 'Não iniciado',
  data_inicio DATE,
  data_conclusao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view servicos_os"
  ON public.servicos_os FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert servicos_os"
  ON public.servicos_os FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update servicos_os"
  ON public.servicos_os FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete servicos_os"
  ON public.servicos_os FOR DELETE TO authenticated
  USING (is_adm_master());

CREATE TRIGGER update_servicos_os_updated_at
  BEFORE UPDATE ON public.servicos_os
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de histórico de ações nas OS
CREATE TABLE public.historico_os (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  acao TEXT NOT NULL,
  comentario TEXT,
  status_anterior TEXT,
  status_novo TEXT,
  servico_afetado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view historico_os"
  ON public.historico_os FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert historico_os"
  ON public.historico_os FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_servicos_os_ordem_id ON public.servicos_os(ordem_id);
CREATE INDEX idx_historico_os_ordem_id ON public.historico_os(ordem_id);
CREATE INDEX idx_ordens_servico_status ON public.ordens_servico(status_os);
CREATE INDEX idx_ordens_servico_numero ON public.ordens_servico(numero_os);
