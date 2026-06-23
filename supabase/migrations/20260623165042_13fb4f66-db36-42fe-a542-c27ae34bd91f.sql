
-- 1) Recreate categoria enum (no data exists)
ALTER TABLE public.contract_templates ALTER COLUMN categoria DROP DEFAULT;
ALTER TABLE public.contract_templates ALTER COLUMN categoria TYPE text USING categoria::text;
DROP TYPE IF EXISTS public.contract_categoria;
CREATE TYPE public.contract_categoria AS ENUM (
  'gestao_ocupacional',
  'contrato_por_uso',
  'contrato_pontual',
  'contrato_parceiras',
  'outros'
);
UPDATE public.contract_templates
  SET categoria = CASE
    WHEN categoria IN ('gestao_ocupacional','contrato_por_uso','contrato_pontual','outros') THEN categoria
    ELSE 'outros'
  END;
ALTER TABLE public.contract_templates
  ALTER COLUMN categoria TYPE public.contract_categoria USING categoria::public.contract_categoria,
  ALTER COLUMN categoria SET DEFAULT 'outros'::public.contract_categoria;

-- 2) contract_placeholders table
CREATE TABLE public.contract_placeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  label text NOT NULL,
  descricao text,
  grupo text NOT NULL DEFAULT 'outros',
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_placeholders TO authenticated;
GRANT ALL ON public.contract_placeholders TO service_role;

ALTER TABLE public.contract_placeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "placeholders read auth" ON public.contract_placeholders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "placeholders insert adm_master" ON public.contract_placeholders
  FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());
CREATE POLICY "placeholders update adm_master" ON public.contract_placeholders
  FOR UPDATE TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());
CREATE POLICY "placeholders delete adm_master" ON public.contract_placeholders
  FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE TRIGGER contract_placeholders_updated_at
  BEFORE UPDATE ON public.contract_placeholders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Seed
INSERT INTO public.contract_placeholders (chave, label, grupo, ordem) VALUES
  ('RAZAO_SOCIAL','Razão Social','cliente',10),
  ('NOME_FANTASIA','Nome Fantasia','cliente',20),
  ('CNPJ','CNPJ','cliente',30),
  ('ENDERECO','Endereço completo','cliente',40),
  ('CEP','CEP','cliente',50),
  ('CIDADE','Cidade','cliente',60),
  ('ESTADO','Estado (UF)','cliente',70),
  ('NUMERO_PROPOSTA','Número da Proposta','contrato',10),
  ('VIGENCIA','Vigência (meses)','contrato',20),
  ('DATA_INICIO','Data de Início','contrato',30),
  ('DATA_FIM','Data de Término','contrato',40),
  ('PRAZO_AVISO','Prazo de Aviso Prévio','contrato',50),
  ('INDICE_REAJUSTE','Índice de Reajuste','contrato',60),
  ('VALOR_MENSAL','Valor Mensal','financeiro',10),
  ('QTD_VIDAS','Quantidade de Vidas','financeiro',20),
  ('VALOR_EXCEDENTE','Valor por Vida Excedente','financeiro',30),
  ('VALOR_KM','Valor KM Rodado','financeiro',40),
  ('DIA_COBRANCA','Dia de Cobrança','financeiro',50),
  ('MULTA','% de Multa','financeiro',60),
  ('JUROS','% de Juros','financeiro',70),
  ('REPRESENTANTE','Representante Legal','assinatura',10),
  ('CPF_REPRESENTANTE','CPF do Representante','assinatura',20),
  ('TESTEMUNHA_1','Testemunha 1','assinatura',30),
  ('CPF_TESTEMUNHA_1','CPF Testemunha 1','assinatura',40),
  ('TESTEMUNHA_2','Testemunha 2','assinatura',50),
  ('CPF_TESTEMUNHA_2','CPF Testemunha 2','assinatura',60),
  ('CARGA_HORARIA','Carga Horária','treinamentos',10),
  ('VALIDADE_CERTIFICADO','Validade do Certificado','treinamentos',20);
