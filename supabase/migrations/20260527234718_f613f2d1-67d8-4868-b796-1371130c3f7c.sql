
-- ============================================================
-- 1) Tabela de médicos assinantes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aso_signing_doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  crm text NOT NULL,
  crm_uf text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aso_signing_doctors_crm ON public.aso_signing_doctors (lower(crm), coalesce(lower(crm_uf), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_signing_doctors TO authenticated;
GRANT ALL ON public.aso_signing_doctors TO service_role;

ALTER TABLE public.aso_signing_doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ASO module users can view signing doctors"
ON public.aso_signing_doctors FOR SELECT TO authenticated
USING (
  public.is_adm_master()
  OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
    WHERE gum.module_route LIKE '/liberacao-asos%' AND gum.can_view = true
  )
);

CREATE POLICY "Only ADM Master can insert signing doctors"
ON public.aso_signing_doctors FOR INSERT TO authenticated
WITH CHECK (public.is_adm_master());

CREATE POLICY "Only ADM Master can update signing doctors"
ON public.aso_signing_doctors FOR UPDATE TO authenticated
USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE POLICY "Only ADM Master can delete signing doctors"
ON public.aso_signing_doctors FOR DELETE TO authenticated
USING (public.is_adm_master());

CREATE TRIGGER trg_aso_signing_doctors_updated_at
BEFORE UPDATE ON public.aso_signing_doctors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) Vínculo do médico assinante no atendimento
-- ============================================================
ALTER TABLE public.aso_atendimentos
  ADD COLUMN IF NOT EXISTS signing_doctor_id uuid REFERENCES public.aso_signing_doctors(id) ON DELETE SET NULL;

-- ============================================================
-- 3) Novas colunas em aso_exames_atendimento
-- ============================================================
ALTER TABLE public.aso_exames_atendimento
  ADD COLUMN IF NOT EXISTS motivo_pendencia text,
  ADD COLUMN IF NOT EXISTS motivo_nova_coleta text,
  ADD COLUMN IF NOT EXISTS nova_coleta_data_prevista_retorno date,
  ADD COLUMN IF NOT EXISTS nova_coleta_data_retorno_efetivo date,
  ADD COLUMN IF NOT EXISTS colaborador_chamado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS colaborador_chamado_em timestamptz,
  ADD COLUMN IF NOT EXISTS colaborador_chamado_por uuid;

ALTER TABLE public.aso_exames_atendimento
  ALTER COLUMN status SET DEFAULT 'aguardando'::public.aso_exame_status;

-- Backfill: legacy 'pendente' (sem motivo) → 'aguardando'
UPDATE public.aso_exames_atendimento
SET status = 'aguardando'::public.aso_exame_status
WHERE status = 'pendente'::public.aso_exame_status
  AND (motivo_pendencia IS NULL OR btrim(motivo_pendencia) = '');

CREATE INDEX IF NOT EXISTS idx_aso_exames_nova_coleta
  ON public.aso_exames_atendimento (status)
  WHERE status = 'nova_coleta'::public.aso_exame_status;

-- ============================================================
-- 4) Validação: status pendente exige motivo
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_aso_exame_status_motivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pendente'::public.aso_exame_status
     AND (NEW.motivo_pendencia IS NULL OR btrim(NEW.motivo_pendencia) = '') THEN
    RAISE EXCEPTION 'Motivo da pendência é obrigatório quando o exame está como Pendente.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aso_exame_motivo_pendencia ON public.aso_exames_atendimento;
CREATE TRIGGER trg_aso_exame_motivo_pendencia
BEFORE INSERT OR UPDATE OF status, motivo_pendencia ON public.aso_exames_atendimento
FOR EACH ROW EXECUTE FUNCTION public.validate_aso_exame_status_motivo();

-- ============================================================
-- 5) Notificação automática para enfermagem em Nova Coleta
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_nursing_nova_coleta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atend RECORD;
  v_user_id uuid;
BEGIN
  IF NEW.status <> 'nova_coleta'::public.aso_exame_status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'nova_coleta'::public.aso_exame_status THEN
    RETURN NEW;
  END IF;

  SELECT id_interno, funcionario, empresa
    INTO v_atend
    FROM public.aso_atendimentos
    WHERE id = NEW.atendimento_id;

  FOR v_user_id IN
    SELECT DISTINCT p.user_id
    FROM public.permissions p
    JOIN public.modules m ON m.id = p.module_id
    WHERE p.user_id IS NOT NULL
      AND m.route = '/liberacao-asos/enfermagem'
      AND p.can_view = true
    UNION
    SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role = 'adm_master'
  LOOP
    INSERT INTO public.notifications (user_id, notification_type, title, content, related_id, related_type)
    VALUES (
      v_user_id,
      'aso_alerta'::public.notification_type,
      'Nova Coleta solicitada',
      'Exame "' || NEW.nome_exame || '" do ASO ' || COALESCE(v_atend.id_interno, '?') ||
        ' (' || COALESCE(v_atend.funcionario, '—') || ' / ' || COALESCE(v_atend.empresa, '—') || ') marcado como Nova Coleta.',
      NEW.atendimento_id,
      'aso_atendimento'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aso_exame_nova_coleta_notify ON public.aso_exames_atendimento;
CREATE TRIGGER trg_aso_exame_nova_coleta_notify
AFTER INSERT OR UPDATE OF status ON public.aso_exames_atendimento
FOR EACH ROW EXECUTE FUNCTION public.notify_nursing_nova_coleta();

-- ============================================================
-- 6) Realtime
-- ============================================================
ALTER TABLE public.aso_atendimentos REPLICA IDENTITY FULL;
ALTER TABLE public.aso_exames_atendimento REPLICA IDENTITY FULL;
ALTER TABLE public.aso_historico REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aso_atendimentos;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aso_exames_atendimento;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aso_historico;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
