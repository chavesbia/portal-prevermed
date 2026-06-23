
CREATE POLICY "contract_pdfs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-pdfs' AND (
    public.is_adm_master()
    OR public.can_view_module_route(auth.uid(),'/gestao-contratual/contratos')
    OR public.can_view_module_route(auth.uid(),'/gestao-contratual')
  ));
CREATE POLICY "contract_pdfs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-pdfs' AND (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/contratos')
  ));
CREATE POLICY "contract_pdfs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-pdfs' AND (
    public.is_adm_master()
    OR public.can_edit_module_route(auth.uid(),'/gestao-contratual/contratos')
  ));
CREATE POLICY "contract_pdfs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-pdfs' AND public.is_adm_master());
