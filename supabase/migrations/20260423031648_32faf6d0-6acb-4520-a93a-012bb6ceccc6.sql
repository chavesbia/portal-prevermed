CREATE TYPE public.occurrence_contact_origin AS ENUM ('email', 'telefone', 'whatsapp', 'presencial', 'reuniao');
CREATE TYPE public.occurrence_type AS ENUM ('reclamacao', 'solicitacao', 'duvida', 'sugestao', 'ocorrencia');
CREATE TYPE public.occurrence_priority AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE public.occurrence_status AS ENUM ('aberto', 'em_analise', 'em_tratativa', 'aguardando_retorno_interno', 'aguardando_cliente', 'resolvido', 'aguardando_validacao_cliente', 'concluido', 'reaberto');
CREATE TYPE public.occurrence_sector AS ENUM ('recepcao', 'enfermagem', 'medico', 'liberacao', 'faturamento', 'comercial', 'relacionamento', 'financeiro', 'engenharia', 'operacional', 'esocial', 'credenciamento', 'agendamento', 'suporte');
CREATE TYPE public.occurrence_assignee_role AS ENUM ('principal', 'apoio');
CREATE TYPE public.occurrence_comment_type AS ENUM ('comentario_interno', 'resposta_cliente', 'nota_status', 'sistema');

CREATE TABLE public.occurrence_sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority public.occurrence_priority NOT NULL UNIQUE,
  target_hours integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.occurrence_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  company_name text NOT NULL,
  cnpj text NOT NULL,
  requester_name text,
  requester_contact text,
  contact_origin public.occurrence_contact_origin NOT NULL,
  ticket_type public.occurrence_type NOT NULL,
  priority public.occurrence_priority NOT NULL DEFAULT 'media',
  description text NOT NULL,
  unit text,
  primary_sector public.occurrence_sector,
  involved_sectors public.occurrence_sector[] NOT NULL DEFAULT '{}',
  status public.occurrence_status NOT NULL DEFAULT 'aberto',
  action_plan_what text,
  action_plan_how text,
  action_plan_due_at timestamptz,
  action_plan_owner_id uuid,
  due_at timestamptz,
  last_internal_update_at timestamptz,
  last_client_response_at timestamptz,
  resolved_at timestamptz,
  client_validated boolean NOT NULL DEFAULT false,
  client_validated_at timestamptz,
  concluded_at timestamptz,
  reopened_reason text,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.occurrence_ticket_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.occurrence_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assignment_role public.occurrence_assignee_role NOT NULL DEFAULT 'apoio',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (ticket_id, user_id)
);

CREATE TABLE public.occurrence_ticket_sector_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.occurrence_tickets(id) ON DELETE CASCADE,
  sector public.occurrence_sector NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (ticket_id, sector)
);

CREATE TABLE public.occurrence_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.occurrence_tickets(id) ON DELETE CASCADE,
  comment_type public.occurrence_comment_type NOT NULL DEFAULT 'comentario_interno',
  body text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.occurrence_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.occurrence_tickets(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  file_url text NOT NULL,
  content_type text,
  file_size bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.occurrence_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.occurrence_tickets(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  details jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.occurrence_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.occurrence_tickets(id) ON DELETE CASCADE,
  from_status public.occurrence_status,
  to_status public.occurrence_status NOT NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  changed_by uuid,
  reason text
);

CREATE INDEX idx_occurrence_tickets_company_name ON public.occurrence_tickets(company_name);
CREATE INDEX idx_occurrence_tickets_status ON public.occurrence_tickets(status);
CREATE INDEX idx_occurrence_tickets_priority ON public.occurrence_tickets(priority);
CREATE INDEX idx_occurrence_tickets_primary_sector ON public.occurrence_tickets(primary_sector);
CREATE INDEX idx_occurrence_tickets_created_at ON public.occurrence_tickets(created_at DESC);
CREATE INDEX idx_occurrence_tickets_due_at ON public.occurrence_tickets(due_at);
CREATE INDEX idx_occurrence_tickets_involved_sectors ON public.occurrence_tickets USING GIN(involved_sectors);
CREATE INDEX idx_occurrence_ticket_assignees_user_id ON public.occurrence_ticket_assignees(user_id);
CREATE INDEX idx_occurrence_ticket_assignees_ticket_id_active ON public.occurrence_ticket_assignees(ticket_id, is_active);
CREATE INDEX idx_occurrence_ticket_sector_assignments_ticket_id ON public.occurrence_ticket_sector_assignments(ticket_id);
CREATE INDEX idx_occurrence_comments_ticket_id_created_at ON public.occurrence_comments(ticket_id, created_at DESC);
CREATE INDEX idx_occurrence_history_ticket_id_performed_at ON public.occurrence_history(ticket_id, performed_at DESC);
CREATE INDEX idx_occurrence_status_events_ticket_id_entered_at ON public.occurrence_status_events(ticket_id, entered_at DESC);

ALTER TABLE public.occurrence_sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_ticket_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_ticket_sector_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_status_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_occurrence_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  seq_value bigint;
BEGIN
  seq_value := nextval('pg_catalog.pg_sequence_last_value'::regclass);
  RETURN 'OC-' || to_char(now(), 'YYYYMM') || '-' || lpad(seq_value::text, 5, '0');
EXCEPTION
  WHEN undefined_table OR undefined_object THEN
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS public.occurrence_ticket_number_seq START 1';
    seq_value := nextval('public.occurrence_ticket_number_seq');
    RETURN 'OC-' || to_char(now(), 'YYYYMM') || '-' || lpad(seq_value::text, 5, '0');
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.occurrence_ticket_number_seq START 1;

CREATE OR REPLACE FUNCTION public.is_occurrence_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'adm_master')
    OR public.has_role(_user_id, 'adm_user')
    OR public.can_edit_module_route(_user_id, '/gestao-ocorrencias/gestao');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_occurrence_ticket(_user_id uuid, _ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_occurrence_manager(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.occurrence_ticket_assignees ota
      WHERE ota.ticket_id = _ticket_id
        AND ota.user_id = _user_id
        AND ota.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.can_close_occurrence_ticket(_user_id uuid, _ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_occurrence_manager(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.calculate_occurrence_due_at(_priority public.occurrence_priority, _base_time timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    _base_time + make_interval(hours => (
      SELECT osc.target_hours
      FROM public.occurrence_sla_config osc
      WHERE osc.priority = _priority AND osc.is_active = true
      LIMIT 1
    )),
    _base_time
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_occurrence_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_client_response boolean;
BEGIN
  IF trim(COALESCE(NEW.company_name, '')) = '' THEN
    RAISE EXCEPTION 'Empresa é obrigatória.';
  END IF;

  IF trim(COALESCE(NEW.cnpj, '')) = '' THEN
    RAISE EXCEPTION 'CNPJ é obrigatório.';
  END IF;

  IF trim(COALESCE(NEW.description, '')) = '' THEN
    RAISE EXCEPTION 'Descrição é obrigatória.';
  END IF;

  IF NEW.status IN ('em_tratativa', 'resolvido', 'aguardando_validacao_cliente', 'concluido') THEN
    IF trim(COALESCE(NEW.action_plan_what, '')) = ''
      OR trim(COALESCE(NEW.action_plan_how, '')) = ''
      OR NEW.action_plan_due_at IS NULL
      OR NEW.action_plan_owner_id IS NULL THEN
      RAISE EXCEPTION 'Plano de ação completo é obrigatório para avançar o chamado.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'reaberto' AND OLD.status IS DISTINCT FROM 'reaberto' THEN
    IF trim(COALESCE(NEW.reopened_reason, '')) = '' THEN
      RAISE EXCEPTION 'Justificativa é obrigatória para reabrir o chamado.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.occurrence_comments oc
      WHERE oc.ticket_id = NEW.id
        AND oc.comment_type = 'resposta_cliente'
    ) INTO has_client_response;

    IF NOT has_client_response THEN
      RAISE EXCEPTION 'Não é possível concluir sem resposta registrada ao cliente.';
    END IF;

    IF COALESCE(NEW.client_validated, false) = false OR NEW.client_validated_at IS NULL THEN
      RAISE EXCEPTION 'Não é possível concluir sem validação do cliente.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND COALESCE(NEW.ticket_number, '') = '' THEN
    NEW.ticket_number := 'OC-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.occurrence_ticket_number_seq')::text, 5, '0');
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.due_at := COALESCE(NEW.due_at, public.calculate_occurrence_due_at(NEW.priority, now()));
    NEW.last_internal_update_at := COALESCE(NEW.last_internal_update_at, now());
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.priority IS DISTINCT FROM OLD.priority THEN
    NEW.due_at := public.calculate_occurrence_due_at(NEW.priority, COALESCE(OLD.created_at, now()));
  END IF;

  IF NEW.status = 'resolvido' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  ELSIF NEW.status <> 'resolvido' AND TG_OP = 'UPDATE' AND OLD.status = 'resolvido' AND NEW.status <> 'concluido' THEN
    NEW.resolved_at := NULL;
  END IF;

  IF NEW.status = 'concluido' AND NEW.concluded_at IS NULL THEN
    NEW.concluded_at := now();
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'concluido' AND NEW.status <> 'concluido' THEN
    NEW.concluded_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_occurrence_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by <> auth.uid() AND NOT public.is_occurrence_manager(auth.uid()) THEN
      RAISE EXCEPTION 'Você não pode abrir chamado em nome de outro usuário.';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.can_manage_occurrence_ticket(auth.uid(), COALESCE(NEW.id, OLD.id)) THEN
    RAISE EXCEPTION 'Você não tem permissão para editar este chamado.';
  END IF;

  IF NEW.status = 'reaberto' AND OLD.status IS DISTINCT FROM 'reaberto' AND NOT public.is_occurrence_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Somente a gestão pode reabrir chamados.';
  END IF;

  IF NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido' AND NOT public.can_close_occurrence_ticket(auth.uid(), NEW.id) THEN
    RAISE EXCEPTION 'Somente a gestão pode concluir chamados.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_occurrence_ticket_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
BEGIN
  actor := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.occurrence_history (ticket_id, action_type, details, performed_by)
    VALUES (
      NEW.id,
      'ticket_created',
      jsonb_build_object('ticket_number', NEW.ticket_number, 'status', NEW.status, 'priority', NEW.priority),
      actor
    );

    INSERT INTO public.occurrence_status_events (ticket_id, from_status, to_status, entered_at, changed_by, reason)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(NEW.created_at, now()), actor, 'Abertura do chamado');

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.occurrence_status_events
    SET exited_at = now()
    WHERE ticket_id = NEW.id
      AND exited_at IS NULL;

    INSERT INTO public.occurrence_status_events (ticket_id, from_status, to_status, entered_at, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, now(), actor, CASE WHEN NEW.status = 'reaberto' THEN NEW.reopened_reason ELSE NULL END);

    INSERT INTO public.occurrence_history (ticket_id, action_type, field_name, old_value, new_value, performed_by)
    VALUES (NEW.id, 'status_changed', 'status', OLD.status::text, NEW.status::text, actor);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.occurrence_history (ticket_id, action_type, field_name, old_value, new_value, performed_by)
    VALUES (NEW.id, 'priority_changed', 'priority', OLD.priority::text, NEW.priority::text, actor);
  END IF;

  IF NEW.action_plan_owner_id IS DISTINCT FROM OLD.action_plan_owner_id THEN
    INSERT INTO public.occurrence_history (ticket_id, action_type, field_name, old_value, new_value, performed_by)
    VALUES (NEW.id, 'action_plan_owner_changed', 'action_plan_owner_id', COALESCE(OLD.action_plan_owner_id::text, ''), COALESCE(NEW.action_plan_owner_id::text, ''), actor);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_occurrence_comment_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.occurrence_history (ticket_id, action_type, details, performed_by)
  VALUES (
    NEW.ticket_id,
    CASE WHEN NEW.comment_type = 'resposta_cliente' THEN 'client_response_added' ELSE 'comment_added' END,
    jsonb_build_object('comment_type', NEW.comment_type, 'comment_id', NEW.id),
    NEW.created_by
  );

  UPDATE public.occurrence_tickets
  SET last_internal_update_at = CASE WHEN NEW.comment_type <> 'resposta_cliente' THEN now() ELSE last_internal_update_at END,
      last_client_response_at = CASE WHEN NEW.comment_type = 'resposta_cliente' THEN now() ELSE last_client_response_at END,
      updated_at = now()
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_occurrence_assignment_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.occurrence_history (ticket_id, action_type, details, performed_by)
    VALUES (
      NEW.ticket_id,
      'assignee_added',
      jsonb_build_object('user_id', NEW.user_id, 'assignment_role', NEW.assignment_role),
      NEW.assigned_by
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.occurrence_history (ticket_id, action_type, details, performed_by)
  VALUES (
    OLD.ticket_id,
    'assignee_updated',
    jsonb_build_object('user_id', COALESCE(NEW.user_id, OLD.user_id), 'is_active', COALESCE(NEW.is_active, OLD.is_active), 'assignment_role', COALESCE(NEW.assignment_role, OLD.assignment_role)),
    COALESCE(NEW.assigned_by, OLD.assigned_by)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_occurrence_attachment(_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_occurrence_manager(auth.uid())
    OR public.can_manage_occurrence_ticket(auth.uid(), _ticket_id)
    OR EXISTS (SELECT 1 FROM public.occurrence_tickets ot WHERE ot.id = _ticket_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_occurrence_attachment_path(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_occurrence_attachment(NULLIF(split_part(_path, '/', 1), '')::uuid);
$$;

CREATE TRIGGER validate_occurrence_ticket_before_write
BEFORE INSERT OR UPDATE ON public.occurrence_tickets
FOR EACH ROW
EXECUTE FUNCTION public.validate_occurrence_ticket();

CREATE TRIGGER enforce_occurrence_permissions_before_write
BEFORE INSERT OR UPDATE ON public.occurrence_tickets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_occurrence_permissions();

CREATE TRIGGER update_occurrence_tickets_updated_at
BEFORE UPDATE ON public.occurrence_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_occurrence_sla_config_updated_at
BEFORE UPDATE ON public.occurrence_sla_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_occurrence_comments_updated_at
BEFORE UPDATE ON public.occurrence_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER log_occurrence_ticket_history_after_write
AFTER INSERT OR UPDATE ON public.occurrence_tickets
FOR EACH ROW
EXECUTE FUNCTION public.log_occurrence_ticket_history();

CREATE TRIGGER log_occurrence_comment_history_after_insert
AFTER INSERT ON public.occurrence_comments
FOR EACH ROW
EXECUTE FUNCTION public.log_occurrence_comment_history();

CREATE TRIGGER log_occurrence_assignment_history_after_write
AFTER INSERT OR UPDATE ON public.occurrence_ticket_assignees
FOR EACH ROW
EXECUTE FUNCTION public.log_occurrence_assignment_history();

CREATE POLICY "Authenticated users can view SLA config"
ON public.occurrence_sla_config
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Occurrence managers can manage SLA config"
ON public.occurrence_sla_config
FOR ALL
TO authenticated
USING (public.is_occurrence_manager(auth.uid()))
WITH CHECK (public.is_occurrence_manager(auth.uid()));

CREATE POLICY "Authenticated users can view occurrence tickets"
ON public.occurrence_tickets
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create occurrence tickets"
ON public.occurrence_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR public.is_occurrence_manager(auth.uid())));

CREATE POLICY "Assigned users and managers can update occurrence tickets"
ON public.occurrence_tickets
FOR UPDATE
TO authenticated
USING (public.can_manage_occurrence_ticket(auth.uid(), id))
WITH CHECK (public.can_manage_occurrence_ticket(auth.uid(), id));

CREATE POLICY "Occurrence managers can delete tickets"
ON public.occurrence_tickets
FOR DELETE
TO authenticated
USING (public.is_occurrence_manager(auth.uid()));

CREATE POLICY "Authenticated users can view assignees"
ON public.occurrence_ticket_assignees
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.occurrence_tickets ot
  WHERE ot.id = occurrence_ticket_assignees.ticket_id
));

CREATE POLICY "Assigned users and managers can manage assignees"
ON public.occurrence_ticket_assignees
FOR ALL
TO authenticated
USING (public.can_manage_occurrence_ticket(auth.uid(), ticket_id))
WITH CHECK (public.can_manage_occurrence_ticket(auth.uid(), ticket_id));

CREATE POLICY "Authenticated users can view sector assignments"
ON public.occurrence_ticket_sector_assignments
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.occurrence_tickets ot
  WHERE ot.id = occurrence_ticket_sector_assignments.ticket_id
));

CREATE POLICY "Assigned users and managers can manage sector assignments"
ON public.occurrence_ticket_sector_assignments
FOR ALL
TO authenticated
USING (public.can_manage_occurrence_ticket(auth.uid(), ticket_id))
WITH CHECK (public.can_manage_occurrence_ticket(auth.uid(), ticket_id));

CREATE POLICY "Authenticated users can view comments"
ON public.occurrence_comments
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.occurrence_tickets ot
  WHERE ot.id = occurrence_comments.ticket_id
));

CREATE POLICY "Assigned users and managers can create comments"
ON public.occurrence_comments
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() AND public.can_manage_occurrence_ticket(auth.uid(), ticket_id));

CREATE POLICY "Comment authors and managers can update comments"
ON public.occurrence_comments
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.is_occurrence_manager(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_occurrence_manager(auth.uid()));

CREATE POLICY "Occurrence managers can delete comments"
ON public.occurrence_comments
FOR DELETE
TO authenticated
USING (public.is_occurrence_manager(auth.uid()));

CREATE POLICY "Authenticated users can view attachments"
ON public.occurrence_attachments
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.occurrence_tickets ot
  WHERE ot.id = occurrence_attachments.ticket_id
));

CREATE POLICY "Assigned users and managers can create attachments"
ON public.occurrence_attachments
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid() AND public.can_manage_occurrence_ticket(auth.uid(), ticket_id));

CREATE POLICY "Assigned users and managers can delete attachments"
ON public.occurrence_attachments
FOR DELETE
TO authenticated
USING (public.can_manage_occurrence_ticket(auth.uid(), ticket_id));

CREATE POLICY "Authenticated users can view history"
ON public.occurrence_history
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.occurrence_tickets ot
  WHERE ot.id = occurrence_history.ticket_id
));

CREATE POLICY "System and managers can insert history"
ON public.occurrence_history
FOR INSERT
TO authenticated
WITH CHECK (performed_by = auth.uid() OR public.is_occurrence_manager(auth.uid()));

CREATE POLICY "Authenticated users can view status events"
ON public.occurrence_status_events
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.occurrence_tickets ot
  WHERE ot.id = occurrence_status_events.ticket_id
));

CREATE POLICY "System and managers can insert status events"
ON public.occurrence_status_events
FOR INSERT
TO authenticated
WITH CHECK (changed_by = auth.uid() OR public.is_occurrence_manager(auth.uid()));

INSERT INTO public.occurrence_sla_config (priority, target_hours)
VALUES
  ('critica', 4),
  ('alta', 8),
  ('media', 24),
  ('baixa', 48)
ON CONFLICT (priority) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('occurrence-attachments', 'occurrence-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Occurrence attachments are readable by authenticated users with ticket access"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'occurrence-attachments'
  AND public.can_access_occurrence_attachment_path(name)
);

CREATE POLICY "Occurrence attachments can be uploaded by assigned users and managers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'occurrence-attachments'
  AND owner = auth.uid()
  AND public.can_access_occurrence_attachment_path(name)
);

CREATE POLICY "Occurrence attachments can be deleted by assigned users and managers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'occurrence-attachments'
  AND public.can_access_occurrence_attachment_path(name)
);