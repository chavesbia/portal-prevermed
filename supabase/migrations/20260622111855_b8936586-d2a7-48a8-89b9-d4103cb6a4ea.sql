
CREATE TYPE public.fb_classificacao AS ENUM ('insuficiente','fraco','razoavel','bom','excelente');
CREATE TYPE public.fb_risco AS ENUM ('baixo','medio','alto');
CREATE TYPE public.fb_acao_status AS ENUM ('nao_iniciado','em_andamento','concluido','atrasado');
CREATE TYPE public.fb_colaborador_status AS ENUM ('ativo','inativo','ferias','afastado');

CREATE TABLE public.fb_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_setores TO authenticated;
GRANT ALL ON public.fb_setores TO service_role;
ALTER TABLE public.fb_setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_setores select" ON public.fb_setores FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fb_is_rh(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'adm_master')
      OR public.can_edit_module_route(_user_id, '/gestao-feedback/configuracoes');
$$;

CREATE POLICY "fb_setores write rh" ON public.fb_setores FOR ALL TO authenticated
  USING (public.fb_is_rh(auth.uid())) WITH CHECK (public.fb_is_rh(auth.uid()));

CREATE TABLE public.fb_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  matricula text UNIQUE,
  cpf text UNIQUE,
  cargo text,
  setor_id uuid REFERENCES public.fb_setores(id) ON DELETE SET NULL,
  gestor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_admissao date,
  status public.fb_colaborador_status NOT NULL DEFAULT 'ativo',
  periodicidade_dias int NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fb_colab_gestor ON public.fb_colaboradores(gestor_id);
CREATE INDEX idx_fb_colab_setor ON public.fb_colaboradores(setor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_colaboradores TO authenticated;
GRANT ALL ON public.fb_colaboradores TO service_role;
ALTER TABLE public.fb_colaboradores ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fb_is_gestor_de(_user_id uuid, _colaborador_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.fb_colaboradores WHERE id = _colaborador_id AND gestor_id = _user_id);
$$;

CREATE POLICY "fb_colab select" ON public.fb_colaboradores FOR SELECT TO authenticated
  USING (public.fb_is_rh(auth.uid()) OR gestor_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "fb_colab insert rh" ON public.fb_colaboradores FOR INSERT TO authenticated
  WITH CHECK (public.fb_is_rh(auth.uid()));
CREATE POLICY "fb_colab update rh" ON public.fb_colaboradores FOR UPDATE TO authenticated
  USING (public.fb_is_rh(auth.uid())) WITH CHECK (public.fb_is_rh(auth.uid()));
CREATE POLICY "fb_colab delete rh" ON public.fb_colaboradores FOR DELETE TO authenticated
  USING (public.fb_is_rh(auth.uid()));

CREATE TABLE public.fb_competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem int NOT NULL,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_competencias TO authenticated;
GRANT ALL ON public.fb_competencias TO service_role;
ALTER TABLE public.fb_competencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_comp select" ON public.fb_competencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "fb_comp write rh" ON public.fb_competencias FOR ALL TO authenticated
  USING (public.fb_is_rh(auth.uid())) WITH CHECK (public.fb_is_rh(auth.uid()));

CREATE TABLE public.fb_competencia_niveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid NOT NULL REFERENCES public.fb_competencias(id) ON DELETE CASCADE,
  nota int NOT NULL CHECK (nota BETWEEN 1 AND 4),
  descricao_oficial text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competencia_id, nota)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_competencia_niveis TO authenticated;
GRANT ALL ON public.fb_competencia_niveis TO service_role;
ALTER TABLE public.fb_competencia_niveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_niveis select" ON public.fb_competencia_niveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "fb_niveis write rh" ON public.fb_competencia_niveis FOR ALL TO authenticated
  USING (public.fb_is_rh(auth.uid())) WITH CHECK (public.fb_is_rh(auth.uid()));

CREATE TABLE public.fb_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.fb_colaboradores(id) ON DELETE CASCADE,
  gestor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_avaliacao date NOT NULL DEFAULT CURRENT_DATE,
  data_proximo_feedback date,
  atividades text,
  pontos_positivos text,
  pontos_melhora text,
  acoes_melhoria text,
  observacoes text,
  pontuacao_total int,
  classificacao public.fb_classificacao,
  concluida boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fb_aval_colab ON public.fb_avaliacoes(colaborador_id, data_avaliacao DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_avaliacoes TO authenticated;
GRANT ALL ON public.fb_avaliacoes TO service_role;
ALTER TABLE public.fb_avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_aval select" ON public.fb_avaliacoes FOR SELECT TO authenticated
  USING (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), colaborador_id)
         OR EXISTS (SELECT 1 FROM public.fb_colaboradores c WHERE c.id = colaborador_id AND c.user_id = auth.uid()));
CREATE POLICY "fb_aval insert" ON public.fb_avaliacoes FOR INSERT TO authenticated
  WITH CHECK (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), colaborador_id));
CREATE POLICY "fb_aval update" ON public.fb_avaliacoes FOR UPDATE TO authenticated
  USING (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), colaborador_id))
  WITH CHECK (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), colaborador_id));
CREATE POLICY "fb_aval delete" ON public.fb_avaliacoes FOR DELETE TO authenticated
  USING (public.fb_is_rh(auth.uid()));

CREATE TABLE public.fb_avaliacao_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.fb_avaliacoes(id) ON DELETE CASCADE,
  competencia_id uuid NOT NULL REFERENCES public.fb_competencias(id) ON DELETE RESTRICT,
  nota int NOT NULL CHECK (nota BETWEEN 1 AND 4),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (avaliacao_id, competencia_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_avaliacao_notas TO authenticated;
GRANT ALL ON public.fb_avaliacao_notas TO service_role;
ALTER TABLE public.fb_avaliacao_notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_notas all" ON public.fb_avaliacao_notas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fb_avaliacoes a WHERE a.id = avaliacao_id
    AND (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), a.colaborador_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fb_avaliacoes a WHERE a.id = avaliacao_id
    AND (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), a.colaborador_id))));

CREATE TABLE public.fb_feedforward (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.fb_avaliacoes(id) ON DELETE CASCADE,
  acao text NOT NULL,
  responsavel text,
  prazo date,
  status public.fb_acao_status NOT NULL DEFAULT 'nao_iniciado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_feedforward TO authenticated;
GRANT ALL ON public.fb_feedforward TO service_role;
ALTER TABLE public.fb_feedforward ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_ff all" ON public.fb_feedforward FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fb_avaliacoes a WHERE a.id = avaliacao_id
    AND (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), a.colaborador_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fb_avaliacoes a WHERE a.id = avaliacao_id
    AND (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), a.colaborador_id))));

CREATE TABLE public.fb_pdi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.fb_avaliacoes(id) ON DELETE CASCADE,
  competencia_id uuid REFERENCES public.fb_competencias(id) ON DELETE SET NULL,
  acao text NOT NULL,
  responsavel text,
  prazo date,
  evidencia text,
  status public.fb_acao_status NOT NULL DEFAULT 'nao_iniciado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_pdi TO authenticated;
GRANT ALL ON public.fb_pdi TO service_role;
ALTER TABLE public.fb_pdi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_pdi all" ON public.fb_pdi FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fb_avaliacoes a WHERE a.id = avaliacao_id
    AND (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), a.colaborador_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fb_avaliacoes a WHERE a.id = avaliacao_id
    AND (public.fb_is_rh(auth.uid()) OR public.fb_is_gestor_de(auth.uid(), a.colaborador_id))));

CREATE TABLE public.fb_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  periodicidade_padrao_dias int NOT NULL DEFAULT 90,
  alertas_dias int[] NOT NULL DEFAULT ARRAY[30,15,7],
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.fb_config (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, INSERT, UPDATE ON public.fb_config TO authenticated;
GRANT ALL ON public.fb_config TO service_role;
ALTER TABLE public.fb_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_config select" ON public.fb_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "fb_config write rh" ON public.fb_config FOR UPDATE TO authenticated
  USING (public.fb_is_rh(auth.uid())) WITH CHECK (public.fb_is_rh(auth.uid()));

CREATE OR REPLACE FUNCTION public.fb_recalc_avaliacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aval_id uuid := COALESCE(NEW.avaliacao_id, OLD.avaliacao_id);
  v_total int;
  v_class public.fb_classificacao;
BEGIN
  SELECT COALESCE(SUM(nota),0) INTO v_total FROM public.fb_avaliacao_notas WHERE avaliacao_id = v_aval_id;
  v_class := CASE
    WHEN v_total = 0 THEN NULL
    WHEN v_total BETWEEN 10 AND 18 THEN 'insuficiente'::public.fb_classificacao
    WHEN v_total BETWEEN 19 AND 23 THEN 'fraco'::public.fb_classificacao
    WHEN v_total BETWEEN 24 AND 28 THEN 'razoavel'::public.fb_classificacao
    WHEN v_total BETWEEN 29 AND 34 THEN 'bom'::public.fb_classificacao
    WHEN v_total >= 35 THEN 'excelente'::public.fb_classificacao
    ELSE NULL
  END;
  UPDATE public.fb_avaliacoes SET pontuacao_total = v_total, classificacao = v_class, updated_at = now()
   WHERE id = v_aval_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_fb_notas_recalc AFTER INSERT OR UPDATE OR DELETE ON public.fb_avaliacao_notas
  FOR EACH ROW EXECUTE FUNCTION public.fb_recalc_avaliacao();

CREATE TRIGGER trg_fb_setores_updated BEFORE UPDATE ON public.fb_setores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fb_colab_updated BEFORE UPDATE ON public.fb_colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fb_comp_updated BEFORE UPDATE ON public.fb_competencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fb_niveis_updated BEFORE UPDATE ON public.fb_competencia_niveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fb_aval_updated BEFORE UPDATE ON public.fb_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fb_ff_updated BEFORE UPDATE ON public.fb_feedforward
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fb_pdi_updated BEFORE UPDATE ON public.fb_pdi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.fb_v_status_colaborador
WITH (security_invoker = true) AS
SELECT
  c.id AS colaborador_id, c.nome, c.matricula, c.cargo, c.setor_id, s.nome AS setor_nome,
  c.gestor_id, c.status, c.periodicidade_dias,
  ult.id AS ultima_avaliacao_id,
  ult.data_avaliacao AS ultimo_feedback,
  ult.data_proximo_feedback AS proximo_feedback,
  ult.pontuacao_total, ult.classificacao,
  CASE
    WHEN ult.data_proximo_feedback IS NULL THEN 'sem_feedback'
    WHEN ult.data_proximo_feedback < CURRENT_DATE THEN 'atrasado'
    WHEN ult.data_proximo_feedback <= CURRENT_DATE + INTERVAL '15 days' THEN 'proximo'
    ELSE 'em_dia'
  END AS status_feedback,
  CASE
    WHEN ult.pontuacao_total IS NULL THEN 'baixo'::public.fb_risco
    WHEN ult.pontuacao_total < 24 THEN 'alto'::public.fb_risco
    WHEN ult.pontuacao_total BETWEEN 24 AND 28 THEN 'medio'::public.fb_risco
    ELSE 'baixo'::public.fb_risco
  END AS risco
FROM public.fb_colaboradores c
LEFT JOIN public.fb_setores s ON s.id = c.setor_id
LEFT JOIN LATERAL (
  SELECT a.* FROM public.fb_avaliacoes a
  WHERE a.colaborador_id = c.id AND a.concluida = true
  ORDER BY a.data_avaliacao DESC LIMIT 1
) ult ON true;

GRANT SELECT ON public.fb_v_status_colaborador TO authenticated;

INSERT INTO public.fb_competencias (ordem, nome) VALUES
  (1, 'Apresentação Pessoal'),
  (2, 'Produtividade / Qualidade de Trabalho'),
  (3, 'Conhecimento do Trabalho'),
  (4, 'Cooperação'),
  (5, 'Iniciativa'),
  (6, 'Relacionamento Interpessoal'),
  (7, 'Aprendizagem'),
  (8, 'Hierarquia e Disciplina'),
  (9, 'Assiduidade e Pontualidade'),
  (10, 'Atendimento ao Cliente')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.fb_competencia_niveis (competencia_id, nota, descricao_oficial)
SELECT c.id, n.nota, ''
FROM public.fb_competencias c
CROSS JOIN (VALUES (1),(2),(3),(4)) AS n(nota)
ON CONFLICT (competencia_id, nota) DO NOTHING;

INSERT INTO public.modules (name, route, icon, is_active, description) VALUES
  ('Gestão de Feedback', '/gestao-feedback', 'MessageSquareHeart', true, 'Gestão de feedbacks e desempenho'),
  ('Feedback - Colaboradores', '/gestao-feedback/colaboradores', 'Users', true, 'Cadastro de colaboradores'),
  ('Feedback - Avaliações', '/gestao-feedback/feedbacks', 'ClipboardCheck', true, 'Registro de avaliações'),
  ('Feedback - Planos de Ação', '/gestao-feedback/planos-acao', 'Target', true, 'PDI e feedforward'),
  ('Feedback - Indicadores', '/gestao-feedback/indicadores', 'BarChart3', true, 'Indicadores de desempenho'),
  ('Feedback - Configurações', '/gestao-feedback/configuracoes', 'Settings', true, 'Configuração de competências')
ON CONFLICT (name) DO NOTHING;
