CREATE POLICY "Authenticated users read PPP attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ppp-anexos');

CREATE POLICY "PPP editors upload attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ppp-anexos'
    AND (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os')));

CREATE POLICY "PPP editors update attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ppp-anexos'
    AND (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os')));

CREATE POLICY "ADM Master deletes PPP attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ppp-anexos' AND public.is_adm_master());