DROP POLICY "Everyone can view public announcements" ON public.announcements;
CREATE POLICY "Authenticated can view public announcements" ON public.announcements FOR SELECT TO authenticated USING ((is_public = true) OR is_adm_master() OR ((department_id IS NOT NULL) AND is_user_in_department(auth.uid(), department_id)));

DROP POLICY "Everyone can view calendar events" ON public.calendar_events;
CREATE POLICY "Authenticated can view calendar events" ON public.calendar_events FOR SELECT TO authenticated USING (true);

DROP POLICY "Everyone can view dashboards" ON public.dashboards;
CREATE POLICY "Authenticated can view dashboards" ON public.dashboards FOR SELECT TO authenticated USING (true);

DROP POLICY "Everyone can view accessible documents" ON public.documents;
CREATE POLICY "Authenticated can view accessible documents" ON public.documents FOR SELECT TO authenticated USING (
  (is_public = true) OR is_adm_master()
  OR (EXISTS (SELECT 1 FROM document_departments dd JOIN user_departments ud ON ud.department_id = dd.department_id WHERE dd.document_id = documents.id AND ud.user_id = auth.uid()))
  OR (EXISTS (SELECT 1 FROM document_users du WHERE du.document_id = documents.id AND du.user_id = auth.uid()))
);

DROP POLICY "Everyone can view active units" ON public.units;
CREATE POLICY "Authenticated can view active units" ON public.units FOR SELECT TO authenticated USING ((is_active = true) OR is_adm_master());

DROP POLICY "Everyone can view useful links" ON public.useful_links;
CREATE POLICY "Authenticated can view useful links" ON public.useful_links FOR SELECT TO authenticated USING ((is_active = true) OR is_adm_master());

REVOKE SELECT ON public.announcements, public.calendar_events, public.dashboards, public.documents, public.units, public.useful_links FROM anon;