-- Create policies for announcements folder in posts bucket
-- Allow admins to upload files to announcements folder
CREATE POLICY "Admins can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'announcements'
  AND is_admin()
);

-- Allow admins to update announcement images
CREATE POLICY "Admins can update announcement images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'announcements'
  AND is_admin()
);

-- Allow admins to delete announcement images
CREATE POLICY "Admins can delete announcement images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'announcements'
  AND is_admin()
);

-- Allow public read access to announcement images
CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'announcements'
);