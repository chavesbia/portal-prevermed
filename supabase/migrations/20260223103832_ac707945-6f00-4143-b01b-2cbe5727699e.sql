-- Allow adm_master to upload avatars for any user
CREATE POLICY "Admins can upload any avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND public.is_adm_master()
);

-- Allow adm_master to update any avatar
CREATE POLICY "Admins can update any avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' AND public.is_adm_master()
);

-- Allow adm_master to delete any avatar
CREATE POLICY "Admins can delete any avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' AND public.is_adm_master()
);