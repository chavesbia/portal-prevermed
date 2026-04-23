DROP POLICY IF EXISTS "Assigned users and managers can create attachments" ON public.occurrence_attachments;

CREATE POLICY "Ticket creators, assigned users and managers can create attachments"
ON public.occurrence_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.occurrence_tickets ot
      WHERE ot.id = ticket_id
        AND ot.created_by = auth.uid()
    )
    OR public.can_manage_occurrence_ticket(auth.uid(), ticket_id)
  )
);

DROP POLICY IF EXISTS "Occurrence attachments can be uploaded by assigned users and ma" ON storage.objects;
DROP POLICY IF EXISTS "Occurrence attachments can be uploaded by assigned users and managers" ON storage.objects;

CREATE POLICY "Occurrence attachments can be uploaded by creators assigned users and managers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'occurrence-attachments'
  AND owner = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.occurrence_tickets ot
      WHERE ot.id::text = split_part(name, '/', 1)
        AND ot.created_by = auth.uid()
    )
    OR public.can_access_occurrence_attachment_path(name)
  )
);