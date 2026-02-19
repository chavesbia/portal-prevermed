-- Create documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload documents
CREATE POLICY "Admins can upload documents" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documents' AND public.is_admin());

-- Allow admins to delete documents
CREATE POLICY "Admins can delete documents" ON storage.objects
FOR DELETE USING (bucket_id = 'documents' AND public.is_admin());

-- Allow everyone to read documents
CREATE POLICY "Everyone can read documents" ON storage.objects
FOR SELECT USING (bucket_id = 'documents');