-- 1) Adicionar novo valor ao enum aso_status
ALTER TYPE public.aso_status ADD VALUE IF NOT EXISTS 'fechado';

-- 2) Tabela de lotes de fechamento
CREATE TABLE IF NOT EXISTS public.aso_fechamento_lotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_lote TEXT NOT NULL,
  periodo_inicial DATE NOT NULL,
  periodo_final DATE NOT NULL,
  filtro_tipo_prontuario TEXT NOT NULL DEFAULT 'ambos', -- 'fisico' | 'digital' | 'ambos'
  total_prontuarios INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  fechado_por UUID NOT NULL,
  fechado_por_nome TEXT,
  fechado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sequência simples por ano para gerar numero_lote (ex: FECH-2026-0001)
CREATE INDEX IF NOT EXISTS idx_aso_fech_lotes_periodo
  ON public.aso_fechamento_lotes (periodo_inicial, periodo_final);

ALTER TABLE public.aso_fechamento_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fechamento lotes"
  ON public.aso_fechamento_lotes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert fechamento lotes"
  ON public.aso_fechamento_lotes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update fechamento lotes"
  ON public.aso_fechamento_lotes FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "ADM Master can delete fechamento lotes"
  ON public.aso_fechamento_lotes FOR DELETE
  TO authenticated
  USING (public.is_adm_master());

CREATE TRIGGER trg_aso_fech_lotes_updated
  BEFORE UPDATE ON public.aso_fechamento_lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Itens do lote (vínculo prontuário <-> lote)
CREATE TABLE IF NOT EXISTS public.aso_fechamento_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id UUID NOT NULL REFERENCES public.aso_fechamento_lotes(id) ON DELETE CASCADE,
  atendimento_id UUID NOT NULL,
  -- snapshot de dados para preservar relatório mesmo se prontuário mudar
  empresa TEXT,
  funcionario TEXT,
  cpf TEXT,
  data_atendimento DATE,
  unidade TEXT,
  setor TEXT,
  cargo TEXT,
  tipo_prontuario TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_aso_fech_itens_atendimento UNIQUE (atendimento_id)
);

CREATE INDEX IF NOT EXISTS idx_aso_fech_itens_lote
  ON public.aso_fechamento_itens (lote_id);
CREATE INDEX IF NOT EXISTS idx_aso_fech_itens_empresa
  ON public.aso_fechamento_itens (empresa);

ALTER TABLE public.aso_fechamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fechamento itens"
  ON public.aso_fechamento_itens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert fechamento itens"
  ON public.aso_fechamento_itens FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "ADM Master can delete fechamento itens"
  ON public.aso_fechamento_itens FOR DELETE
  TO authenticated
  USING (public.is_adm_master());

-- 4) Referência rápida no atendimento
ALTER TABLE public.aso_atendimentos
  ADD COLUMN IF NOT EXISTS fechamento_lote_id UUID;

CREATE INDEX IF NOT EXISTS idx_aso_atendimentos_fech_lote
  ON public.aso_atendimentos (fechamento_lote_id);
