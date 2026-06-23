
DO $$ BEGIN CREATE TYPE public.contract_status AS ENUM ('rascunho','aguardando_assinatura','parcialmente_assinado','assinado','ativo','vencendo_60','vencendo_30','vencendo_15','vencido','encerrado','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.contract_signer_type AS ENUM ('representante','testemunha_1','testemunha_2'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.contract_signer_status AS ENUM ('pendente','enviado','assinado','recusado','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.contract_template_categoria AS ENUM ('gestao_ocupacional','contrato_por_uso','contrato_por_uso_drps_lgpd','contrato_pontual','treinamentos','outros'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.contract_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL UNIQUE,
  razao_social text NOT NULL,
  nome_fantasia text, cep text, logradouro text, numero text, complemento text,
  bairro text, cidade text, estado text, situacao_cadastral text, cnae_principal text,
  email text, telefone text, representante_legal text, cpf_representante text, observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id), updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_clientes TO authenticated;
GRANT ALL ON public.contract_clientes TO service_role;
ALTER TABLE public.contract_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_view" ON public.contract_clientes FOR SELECT TO authenticated USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(),'/gestao-contratual/clientes') OR public.can_view_module_route(auth.uid(),'/gestao-contratual'));
CREATE POLICY "cc_insert" ON public.contract_clientes FOR INSERT TO authenticated WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/clientes'));
CREATE POLICY "cc_update" ON public.contract_clientes FOR UPDATE TO authenticated USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/clientes'));
CREATE POLICY "cc_delete" ON public.contract_clientes FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria public.contract_template_categoria NOT NULL DEFAULT 'outros',
  descricao text, ativo boolean NOT NULL DEFAULT true,
  versao_atual integer NOT NULL DEFAULT 1,
  current_version_id uuid,
  created_by uuid REFERENCES auth.users(id), updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_view" ON public.contract_templates FOR SELECT TO authenticated USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(),'/gestao-contratual/modelos') OR public.can_view_module_route(auth.uid(),'/gestao-contratual/contratos'));
CREATE POLICY "ct_insert" ON public.contract_templates FOR INSERT TO authenticated WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/modelos'));
CREATE POLICY "ct_update" ON public.contract_templates FOR UPDATE TO authenticated USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/modelos'));
CREATE POLICY "ct_delete" ON public.contract_templates FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE TABLE public.contract_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  conteudo_html text NOT NULL,
  changelog text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, versao)
);
GRANT SELECT, INSERT ON public.contract_template_versions TO authenticated;
GRANT ALL ON public.contract_template_versions TO service_role;
ALTER TABLE public.contract_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctv_view" ON public.contract_template_versions FOR SELECT TO authenticated USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(),'/gestao-contratual/modelos') OR public.can_view_module_route(auth.uid(),'/gestao-contratual/contratos'));
CREATE POLICY "ctv_insert" ON public.contract_template_versions FOR INSERT TO authenticated WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/modelos'));

ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_current_version_fk FOREIGN KEY (current_version_id) REFERENCES public.contract_template_versions(id) ON DELETE SET NULL;

CREATE TABLE public.contract_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrato text UNIQUE,
  cliente_id uuid NOT NULL REFERENCES public.contract_clientes(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  template_version_id uuid REFERENCES public.contract_template_versions(id) ON DELETE SET NULL,
  numero_proposta text, valor_mensal numeric(12,2), qtd_vidas integer, valor_excedente numeric(12,2),
  dia_cobranca integer, multa numeric(5,2), juros numeric(5,2),
  vigencia_meses integer NOT NULL DEFAULT 12,
  indice_reajuste text, prazo_aviso integer, valor_km numeric(12,2),
  data_inicio date NOT NULL, data_fim date,
  status public.contract_status NOT NULL DEFAULT 'rascunho',
  html_final text, pdf_url text, autentique_document_id text,
  rep_nome text, rep_cpf text,
  testemunha1_nome text, testemunha1_cpf text,
  testemunha2_nome text, testemunha2_cpf text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id), updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contract_contratos_cliente ON public.contract_contratos(cliente_id);
CREATE INDEX idx_contract_contratos_status ON public.contract_contratos(status);
CREATE INDEX idx_contract_contratos_data_fim ON public.contract_contratos(data_fim);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_contratos TO authenticated;
GRANT ALL ON public.contract_contratos TO service_role;
ALTER TABLE public.contract_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ck_view" ON public.contract_contratos FOR SELECT TO authenticated USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(),'/gestao-contratual/contratos') OR public.can_view_module_route(auth.uid(),'/gestao-contratual'));
CREATE POLICY "ck_insert" ON public.contract_contratos FOR INSERT TO authenticated WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/contratos'));
CREATE POLICY "ck_update" ON public.contract_contratos FOR UPDATE TO authenticated USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/contratos'));
CREATE POLICY "ck_delete" ON public.contract_contratos FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE TABLE public.contract_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contract_contratos(id) ON DELETE CASCADE,
  tipo public.contract_signer_type NOT NULL,
  nome text NOT NULL, cpf text, email text,
  status public.contract_signer_status NOT NULL DEFAULT 'pendente',
  data_assinatura timestamptz, ip_assinatura text, autentique_signer_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_assinaturas TO authenticated;
GRANT ALL ON public.contract_assinaturas TO service_role;
ALTER TABLE public.contract_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_view" ON public.contract_assinaturas FOR SELECT TO authenticated USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(),'/gestao-contratual/contratos') OR public.can_view_module_route(auth.uid(),'/gestao-contratual/assinaturas'));
CREATE POLICY "ca_insert" ON public.contract_assinaturas FOR INSERT TO authenticated WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/contratos'));
CREATE POLICY "ca_update" ON public.contract_assinaturas FOR UPDATE TO authenticated USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/contratos') OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/assinaturas'));
CREATE POLICY "ca_delete" ON public.contract_assinaturas FOR DELETE TO authenticated USING (public.is_adm_master());

CREATE TABLE public.contract_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contract_contratos(id) ON DELETE CASCADE,
  tipo text NOT NULL, descricao text, detalhes jsonb,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contract_eventos_contrato ON public.contract_eventos(contrato_id, created_at DESC);
GRANT SELECT, INSERT ON public.contract_eventos TO authenticated;
GRANT ALL ON public.contract_eventos TO service_role;
ALTER TABLE public.contract_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_view" ON public.contract_eventos FOR SELECT TO authenticated USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(),'/gestao-contratual/contratos') OR public.can_view_module_route(auth.uid(),'/gestao-contratual'));
CREATE POLICY "ce_insert" ON public.contract_eventos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.contract_calc_status(_data_inicio date, _vigencia_meses integer, _status_atual public.contract_status)
RETURNS public.contract_status LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _status_atual IN ('rascunho','aguardando_assinatura','parcialmente_assinado','cancelado','encerrado') THEN _status_atual
    WHEN _data_inicio IS NULL OR _vigencia_meses IS NULL THEN _status_atual
    ELSE (
      WITH dt AS (SELECT (_data_inicio + (_vigencia_meses || ' months')::interval)::date AS data_fim)
      SELECT CASE
        WHEN (SELECT data_fim FROM dt) < CURRENT_DATE THEN 'vencido'::public.contract_status
        WHEN (SELECT data_fim FROM dt) <= CURRENT_DATE + INTERVAL '15 days' THEN 'vencendo_15'::public.contract_status
        WHEN (SELECT data_fim FROM dt) <= CURRENT_DATE + INTERVAL '30 days' THEN 'vencendo_30'::public.contract_status
        WHEN (SELECT data_fim FROM dt) <= CURRENT_DATE + INTERVAL '60 days' THEN 'vencendo_60'::public.contract_status
        ELSE 'ativo'::public.contract_status
      END
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.contract_contratos_before_save()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE yr text := to_char(now(),'YYYY'); next_seq integer;
BEGIN
  IF NEW.data_inicio IS NOT NULL AND NEW.vigencia_meses IS NOT NULL THEN
    NEW.data_fim := (NEW.data_inicio + (NEW.vigencia_meses || ' months')::interval)::date;
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.numero_contrato IS NULL OR NEW.numero_contrato = '') THEN
    SELECT COALESCE(MAX(CAST(split_part(numero_contrato,'-',3) AS integer)),0)+1
      INTO next_seq FROM public.contract_contratos
      WHERE numero_contrato LIKE 'CTR-'||yr||'-%';
    NEW.numero_contrato := 'CTR-'||yr||'-'||lpad(next_seq::text,4,'0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_contract_contratos_before_save BEFORE INSERT OR UPDATE ON public.contract_contratos FOR EACH ROW EXECUTE FUNCTION public.contract_contratos_before_save();
CREATE TRIGGER trg_contract_clientes_updated BEFORE UPDATE ON public.contract_clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_contract_templates_updated BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_contract_assinaturas_updated BEFORE UPDATE ON public.contract_assinaturas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.modules (name, route, icon, description, is_active, sort_order)
SELECT 'Gestão Contratual', '/gestao-contratual', 'FileSignature', 'Geração, assinatura e gestão de contratos comerciais', true,
  COALESCE((SELECT MAX(sort_order)+1 FROM public.modules), 100)
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE name = 'Gestão Contratual' OR route = '/gestao-contratual');
