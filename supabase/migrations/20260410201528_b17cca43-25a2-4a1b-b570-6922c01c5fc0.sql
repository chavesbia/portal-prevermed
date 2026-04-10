
-- Enum for atendimento status
CREATE TYPE public.aso_status AS ENUM (
  'importado',
  'em_triagem',
  'aguardando_exames',
  'pronto_assinatura_medica',
  'em_escaneamento',
  'liberado',
  'liberado_faturamento',
  'finalizado'
);

-- Enum for prontuario type
CREATE TYPE public.aso_tipo_prontuario AS ENUM ('digital', 'fisico');

-- Enum for exam status
CREATE TYPE public.aso_exame_status AS ENUM (
  'pendente',
  'recebido',
  'datado_soc',
  'inserido_socged',
  'concluido'
);

-- Enum for exam type
CREATE TYPE public.aso_exame_tipo AS ENUM ('imediato', 'complementar');

-- Enum for signature type
CREATE TYPE public.aso_tipo_assinatura AS ENUM ('digital', 'manual');

-- ============================================
-- Table: aso_lotes_importacao
-- ============================================
CREATE TABLE public.aso_lotes_importacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade text NOT NULL, -- 'Lapa' or 'Osasco'
  arquivo_nome text,
  arquivo_tamanho integer,
  total_registros integer NOT NULL DEFAULT 0,
  importado_por uuid NOT NULL,
  importado_por_nome text,
  importado_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.aso_lotes_importacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view aso_lotes" ON public.aso_lotes_importacao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert aso_lotes" ON public.aso_lotes_importacao
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update aso_lotes" ON public.aso_lotes_importacao
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete aso_lotes" ON public.aso_lotes_importacao
  FOR DELETE TO authenticated USING (public.is_adm_master());

-- ============================================
-- Table: aso_atendimentos
-- ============================================
CREATE TABLE public.aso_atendimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_interno text NOT NULL UNIQUE, -- ASO-20260410-LAPA-12345678900-001
  lote_id uuid NOT NULL REFERENCES public.aso_lotes_importacao(id) ON DELETE CASCADE,

  -- Dados importados da planilha SOC
  agenda text, -- unidade do atendimento (Lapa/Osasco)
  data_atendimento date NOT NULL,
  hora_inicial text,
  detalhes text, -- observação do agendamento
  medico text,
  exames_texto text, -- texto bruto dos exames
  riscos text,
  tipo_compromisso text, -- tipo de ASO
  empresa text,
  unidade text, -- unidade do colaborador
  setor text,
  cargo text,
  funcionario text,
  cpf text,
  usuario_soc text, -- quem inseriu no SOC

  -- Classificações operacionais
  tipo_prontuario public.aso_tipo_prontuario,
  base_socnet boolean DEFAULT false,

  -- Campos da recepção
  prontuario_conferido boolean DEFAULT false,
  documentacao_ok boolean DEFAULT false,
  ficha_clinica_ok boolean DEFAULT false,
  vias_aso_ok boolean DEFAULT false,
  carimbo_assinatura_ok boolean DEFAULT false,
  possui_exame_complementar boolean DEFAULT false,
  observacoes_recepcao text,

  -- Assinatura médica
  aso_assinado boolean DEFAULT false,
  tipo_assinatura public.aso_tipo_assinatura,
  data_assinatura date,
  observacoes_assinatura text,

  -- Escaneamento (prontuário físico)
  escaneado boolean DEFAULT false,
  renomeado boolean DEFAULT false,
  salvo_rede boolean DEFAULT false,
  salvo_socged boolean DEFAULT false,
  email_enviado boolean DEFAULT false,
  conferencia_final_ok boolean DEFAULT false,
  observacoes_escaneamento text,

  -- Faturamento
  observacoes_faturamento text,

  -- Fluxo
  status public.aso_status NOT NULL DEFAULT 'importado',
  setor_responsavel text DEFAULT 'Recepção',
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.aso_atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view aso_atendimentos" ON public.aso_atendimentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert aso_atendimentos" ON public.aso_atendimentos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update aso_atendimentos" ON public.aso_atendimentos
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete aso_atendimentos" ON public.aso_atendimentos
  FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE INDEX idx_aso_atendimentos_status ON public.aso_atendimentos(status);
CREATE INDEX idx_aso_atendimentos_agenda ON public.aso_atendimentos(agenda);
CREATE INDEX idx_aso_atendimentos_data ON public.aso_atendimentos(data_atendimento);
CREATE INDEX idx_aso_atendimentos_cpf ON public.aso_atendimentos(cpf);
CREATE INDEX idx_aso_atendimentos_lote ON public.aso_atendimentos(lote_id);

CREATE TRIGGER update_aso_atendimentos_updated_at
  BEFORE UPDATE ON public.aso_atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Table: aso_exames_atendimento
-- ============================================
CREATE TABLE public.aso_exames_atendimento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id uuid NOT NULL REFERENCES public.aso_atendimentos(id) ON DELETE CASCADE,
  nome_exame text NOT NULL,
  tipo public.aso_exame_tipo NOT NULL DEFAULT 'imediato',
  status public.aso_exame_status NOT NULL DEFAULT 'pendente',
  data_recebimento date,
  data_datado_soc date,
  data_inserido_socged date,
  data_conclusao date,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.aso_exames_atendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view aso_exames" ON public.aso_exames_atendimento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert aso_exames" ON public.aso_exames_atendimento
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update aso_exames" ON public.aso_exames_atendimento
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete aso_exames" ON public.aso_exames_atendimento
  FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE INDEX idx_aso_exames_atendimento ON public.aso_exames_atendimento(atendimento_id);

CREATE TRIGGER update_aso_exames_updated_at
  BEFORE UPDATE ON public.aso_exames_atendimento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Table: aso_historico
-- ============================================
CREATE TABLE public.aso_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id uuid NOT NULL REFERENCES public.aso_atendimentos(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  acao text NOT NULL,
  campo text,
  valor_antigo text,
  valor_novo text,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.aso_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view aso_historico" ON public.aso_historico
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert aso_historico" ON public.aso_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
