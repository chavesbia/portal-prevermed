DROP POLICY IF EXISTS "Auth users read os-anexos" ON storage.objects;
CREATE POLICY "Auth users read os-anexos" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'os-anexos'
  AND (
    name NOT LIKE 'soc-agenda/%'
    OR public.is_adm_master()
    OR public.can_view_module_route(auth.uid(), '/agendamentos')
  )
);