-- TABELA DE RESCISÕES CONTRATUAIS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_rescisao_motivo') THEN
    CREATE TYPE public.contract_rescisao_motivo AS ENUM (
      'insatisfacao', 'preco', 'encerramento_atividades', 'transferencia_cnpj', 'mudanca_estrategica', 'alteracao_endereco', 'outro'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_rescisao_status') THEN
    CREATE TYPE public.contract_rescisao_status AS ENUM ('solicitada', 'confirmada');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contract_rescisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contract_contratos(id) ON DELETE SET NULL,
  
  -- Campos manuais quando não há contrato_id
  numero_contrato_manual TEXT,
  vigencia_inicio_manual DATE,
  vigencia_fim_manual DATE,
  qtd_vidas_manual INTEGER,
  valor_mensal_manual NUMERIC(15,2),
  
  -- Solicitante
  solicitante_nome TEXT,
  solicitante_cargo TEXT,
  solicitante_whatsapp TEXT,
  solicitante_email TEXT,
  
  -- Detalhes da rescisão
  motivo public.contract_rescisao_motivo NOT NULL,
  motivo_descricao TEXT,
  valor_fat_1 NUMERIC(15,2),
  valor_fat_2 NUMERIC(15,2),
  valor_fat_3 NUMERIC(15,2),
  data_prevista_inativacao DATE,
  data_real_inativacao DATE,
  data_prevista_ultimo_faturamento DATE,
  clinica_destino TEXT,
  anexo_url TEXT,
  status public.contract_rescisao_status NOT NULL DEFAULT 'solicitada',
  
  -- Metadados
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissões e RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_rescisoes TO authenticated;
GRANT ALL ON public.contract_rescisoes TO service_role;

ALTER TABLE public.contract_rescisoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Usuários autenticados podem ver rescisões' AND tablename = 'contract_rescisoes') THEN
    CREATE POLICY "Usuários autenticados podem ver rescisões"
    ON public.contract_rescisoes FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Usuários autenticados podem inserir rescisões' AND tablename = 'contract_rescisoes') THEN
    CREATE POLICY "Usuários autenticados podem inserir rescisões"
    ON public.contract_rescisoes FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Usuários autenticados podem atualizar rescisões' AND tablename = 'contract_rescisoes') THEN
    CREATE POLICY "Usuários autenticados podem atualizar rescisões"
    ON public.contract_rescisoes FOR UPDATE TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Usuários autenticados podem excluir rescisões' AND tablename = 'contract_rescisoes') THEN
    CREATE POLICY "Usuários autenticados podem excluir rescisões"
    ON public.contract_rescisoes FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- RLS para Storage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Acesso autenticado aos anexos de rescisão' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Acesso autenticado aos anexos de rescisão"
        ON storage.objects FOR ALL TO authenticated
        USING (bucket_id = 'contract-rescisoes')
        WITH CHECK (bucket_id = 'contract-rescisoes');
    END IF;
END $$;

-- Trigger para automatizar o status do contrato e da rescisão
CREATE OR REPLACE FUNCTION public.trg_contract_rescisao_confirmar()
RETURNS TRIGGER AS $$
BEGIN
  -- Se preencheu a data_real_inativacao, muda status da rescisão para confirmada
  IF NEW.data_real_inativacao IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.data_real_inativacao IS NULL) THEN
    NEW.status := 'confirmada';
    
    -- Se houver contrato_id, muda status do contrato para encerrado
    IF NEW.contrato_id IS NOT NULL THEN
      UPDATE public.contract_contratos 
      SET status = 'encerrado' 
      WHERE id = NEW.contrato_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contract_rescisao_confirmar_trigger ON public.contract_rescisoes;
CREATE TRIGGER contract_rescisao_confirmar_trigger
BEFORE INSERT OR UPDATE ON public.contract_rescisoes
FOR EACH ROW EXECUTE FUNCTION public.trg_contract_rescisao_confirmar();
