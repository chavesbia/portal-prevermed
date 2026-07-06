
CREATE OR REPLACE FUNCTION public.can_view_occurrence_ticket(_user_id uuid, _ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_occurrence_manager(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.occurrence_tickets ot
      WHERE ot.id = _ticket_id
        AND (ot.created_by = _user_id
             OR EXISTS (
               SELECT 1 FROM public.occurrence_ticket_assignees ota
               WHERE ota.ticket_id = ot.id AND ota.user_id = _user_id AND ota.is_active = true
             ))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_commercial_module(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_adm_master() OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(_user_id) m
    WHERE m.module_route = '/carteira-comercial' AND m.can_view = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_document_object(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE (d.file_path = _name OR d.file_url LIKE '%' || _name)
      AND (
        d.is_public = true
        OR public.is_adm_master()
        OR EXISTS (SELECT 1 FROM public.document_departments dd
          JOIN public.user_departments ud ON ud.department_id = dd.department_id
          WHERE dd.document_id = d.id AND ud.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.document_users du
          WHERE du.document_id = d.id AND du.user_id = auth.uid())
      )
  );
$$;

DROP POLICY IF EXISTS "Authenticated users can view client_attachments" ON public.client_attachments;
CREATE POLICY "Commercial viewers can view client_attachments"
ON public.client_attachments FOR SELECT TO authenticated
USING (public.can_view_commercial_module(auth.uid()));

DROP POLICY IF EXISTS "contracts_delete" ON public.commercial_contracts;
CREATE POLICY "contracts_delete"
ON public.commercial_contracts FOR DELETE TO authenticated
USING (
  public.is_adm_master() OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
    WHERE m.module_route = '/carteira-comercial' AND m.can_edit = true
  )
);

DROP POLICY IF EXISTS "Everyone can view document departments" ON public.document_departments;
CREATE POLICY "Authenticated can view document departments"
ON public.document_departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view document users" ON public.document_users;
CREATE POLICY "Authenticated can view document users"
ON public.document_users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view client documents" ON storage.objects;
CREATE POLICY "Commercial viewers can read client documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents' AND public.can_view_commercial_module(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read documents bucket" ON storage.objects;
CREATE POLICY "Users can read authorized documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.can_access_document_object(name));

DROP POLICY IF EXISTS "fb_colab select" ON public.fb_colaboradores;
CREATE POLICY "fb_colab select restricted"
ON public.fb_colaboradores FOR SELECT TO authenticated
USING (
  public.fb_is_rh(auth.uid())
  OR user_id = auth.uid()
  OR public.fb_is_gestor_de(auth.uid(), id)
);

DROP POLICY IF EXISTS "Authenticated users can view assignees" ON public.occurrence_ticket_assignees;
CREATE POLICY "Ticket viewers can view assignees"
ON public.occurrence_ticket_assignees FOR SELECT TO authenticated
USING (public.can_view_occurrence_ticket(auth.uid(), ticket_id));

DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.occurrence_attachments;
CREATE POLICY "Ticket viewers can view attachments"
ON public.occurrence_attachments FOR SELECT TO authenticated
USING (public.can_view_occurrence_ticket(auth.uid(), ticket_id));

DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.occurrence_comments;
CREATE POLICY "Ticket viewers can view comments"
ON public.occurrence_comments FOR SELECT TO authenticated
USING (public.can_view_occurrence_ticket(auth.uid(), ticket_id));

DROP POLICY IF EXISTS "Authenticated users can view history" ON public.occurrence_history;
CREATE POLICY "Ticket viewers can view history"
ON public.occurrence_history FOR SELECT TO authenticated
USING (public.can_view_occurrence_ticket(auth.uid(), ticket_id));

DROP POLICY IF EXISTS "Authenticated users can view sector assignments" ON public.occurrence_ticket_sector_assignments;
CREATE POLICY "Ticket viewers can view sector assignments"
ON public.occurrence_ticket_sector_assignments FOR SELECT TO authenticated
USING (public.can_view_occurrence_ticket(auth.uid(), ticket_id));

DROP POLICY IF EXISTS "Authenticated users can view status events" ON public.occurrence_status_events;
CREATE POLICY "Ticket viewers can view status events"
ON public.occurrence_status_events FOR SELECT TO authenticated
USING (public.can_view_occurrence_ticket(auth.uid(), ticket_id));
