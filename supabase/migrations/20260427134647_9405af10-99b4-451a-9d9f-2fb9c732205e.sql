
-- ============================================================
-- Gestão de O.S — FASE 2: Agenda de Visitas + Equipamentos
-- ============================================================

-- Enums
CREATE TYPE public.visita_status AS ENUM ('agendada', 'realizada', 'cancelada');
CREATE TYPE public.visita_tipo AS ENUM ('Avaliação', 'Coleta', 'Inspeção', 'Reunião', 'Treinamento', 'Outro');
CREATE TYPE public.equipamento_status AS ENUM ('ativo', 'em_manutencao', 'inativo', 'descartado');

-- ============================================================
-- TABELA: os_equipamentos (cadastro de equipamentos por cliente)
-- ============================================================
CREATE TABLE public.os_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text,
  empresa_cliente text NOT NULL,
  localizacao text,
  status public.equipamento_status NOT NULL DEFAULT 'ativo',
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_os_equipamentos_cliente ON public.os_equipamentos(empresa_cliente);
CREATE INDEX idx_os_equipamentos_status ON public.os_equipamentos(status);

ALTER TABLE public.os_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar equipamentos com acesso ao módulo OS"
  ON public.os_equipamentos FOR SELECT TO authenticated
  USING (
    public.is_adm_master()
    OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
      WHERE m.module_route = '/gestao-os' AND m.can_view = true
    )
  );

CREATE POLICY "Criar equipamentos com permissão de edição em OS"
  ON public.os_equipamentos FOR INSERT TO authenticated
  WITH CHECK (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  );

CREATE POLICY "Atualizar equipamentos com permissão de edição em OS"
  ON public.os_equipamentos FOR UPDATE TO authenticated
  USING (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  )
  WITH CHECK (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  );

CREATE POLICY "Excluir equipamentos com permissão em OS"
  ON public.os_equipamentos FOR DELETE TO authenticated
  USING (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  );

CREATE TRIGGER trg_os_equipamentos_updated_at
  BEFORE UPDATE ON public.os_equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABELA: os_equipamento_historico (histórico básico do equipamento)
-- ============================================================
CREATE TABLE public.os_equipamento_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL REFERENCES public.os_equipamentos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  acao text NOT NULL,
  comentario text,
  ordem_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_os_equip_hist_equipamento ON public.os_equipamento_historico(equipamento_id);

ALTER TABLE public.os_equipamento_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar histórico de equipamento com acesso ao módulo OS"
  ON public.os_equipamento_historico FOR SELECT TO authenticated
  USING (
    public.is_adm_master()
    OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
      WHERE m.module_route = '/gestao-os' AND m.can_view = true
    )
  );

CREATE POLICY "Inserir histórico equipamento com permissão"
  ON public.os_equipamento_historico FOR INSERT TO authenticated
  WITH CHECK (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  );

-- ============================================================
-- TABELA: os_visitas (agendamento de visitas técnicas)
-- ============================================================
CREATE TABLE public.os_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_cliente text NOT NULL,
  ordem_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  numero_os text,
  data_visita date NOT NULL,
  hora_visita text,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_nome text NOT NULL,
  tipo_visita public.visita_tipo NOT NULL DEFAULT 'Avaliação',
  status public.visita_status NOT NULL DEFAULT 'agendada',
  endereco text,
  observacoes text,
  motivo_cancelamento text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_os_visitas_data ON public.os_visitas(data_visita);
CREATE INDEX idx_os_visitas_responsavel ON public.os_visitas(responsavel_id);
CREATE INDEX idx_os_visitas_ordem ON public.os_visitas(ordem_id);
CREATE INDEX idx_os_visitas_status ON public.os_visitas(status);

ALTER TABLE public.os_visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar visitas com acesso ao módulo OS"
  ON public.os_visitas FOR SELECT TO authenticated
  USING (
    public.is_adm_master()
    OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
      WHERE m.module_route = '/gestao-os' AND m.can_view = true
    )
  );

CREATE POLICY "Criar visitas com permissão de edição em OS"
  ON public.os_visitas FOR INSERT TO authenticated
  WITH CHECK (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  );

CREATE POLICY "Atualizar visitas com permissão de edição em OS"
  ON public.os_visitas FOR UPDATE TO authenticated
  USING (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  )
  WITH CHECK (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  );

CREATE POLICY "Excluir visitas com permissão em OS"
  ON public.os_visitas FOR DELETE TO authenticated
  USING (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  );

CREATE TRIGGER trg_os_visitas_updated_at
  BEFORE UPDATE ON public.os_visitas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABELA: os_visita_equipamentos (vínculo N:N visita x equipamento)
-- ============================================================
CREATE TABLE public.os_visita_equipamentos (
  visita_id uuid NOT NULL REFERENCES public.os_visitas(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.os_equipamentos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visita_id, equipamento_id)
);

ALTER TABLE public.os_visita_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar vínculos com acesso ao módulo OS"
  ON public.os_visita_equipamentos FOR SELECT TO authenticated
  USING (
    public.is_adm_master()
    OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
      WHERE m.module_route = '/gestao-os' AND m.can_view = true
    )
  );

CREATE POLICY "Gerir vínculos visita-equipamento com permissão em OS"
  ON public.os_visita_equipamentos FOR ALL TO authenticated
  USING (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  )
  WITH CHECK (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(), '/gestao-os')
  );

-- ============================================================
-- Histórico automático: registrar criação/cancelamento de visita em historico_os
-- (somente se a visita estiver vinculada a uma OS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_os_visita_to_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := COALESCE(NEW.created_by, NEW.updated_by, auth.uid());
  actor_name text;
BEGIN
  IF NEW.ordem_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.full_name, p.email, 'Sistema') INTO actor_name
  FROM public.profiles p WHERE p.user_id = actor LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historico_os (ordem_id, user_id, user_name, acao, comentario)
    VALUES (
      NEW.ordem_id, actor, COALESCE(actor_name, 'Sistema'),
      'Agendamento de Visita',
      'Visita ' || NEW.tipo_visita::text || ' agendada para ' || to_char(NEW.data_visita, 'DD/MM/YYYY')
        || COALESCE(' às ' || NEW.hora_visita, '') || ' com ' || NEW.responsavel_nome
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.historico_os (ordem_id, user_id, user_name, acao, comentario)
    VALUES (
      NEW.ordem_id, actor, COALESCE(actor_name, 'Sistema'),
      'Atualização de Visita',
      'Visita marcada como ' || NEW.status::text
        || COALESCE(' — ' || NEW.motivo_cancelamento, '')
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_os_visita_log_historico
  AFTER INSERT OR UPDATE ON public.os_visitas
  FOR EACH ROW EXECUTE FUNCTION public.log_os_visita_to_historico();
