
-- Create storage bucket for calendar attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('calendar-attachments', 'calendar-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to calendar-attachments
CREATE POLICY "Admins can upload calendar attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'calendar-attachments' AND public.is_admin());

-- Allow everyone to view calendar attachments
CREATE POLICY "Everyone can view calendar attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'calendar-attachments');

-- Allow admins to delete calendar attachments
CREATE POLICY "Admins can delete calendar attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'calendar-attachments' AND public.is_admin());
