DROP POLICY IF EXISTS "Assigned users and managers can manage assignees" ON public.occurrence_ticket_assignees;

CREATE POLICY "Ticket creators assigned users and managers can manage assignees"
ON public.occurrence_ticket_assignees
FOR ALL
TO authenticated
USING (
  public.can_manage_occurrence_ticket(auth.uid(), ticket_id)
  OR EXISTS (
    SELECT 1
    FROM public.occurrence_tickets ot
    WHERE ot.id = ticket_id
      AND ot.created_by = auth.uid()
  )
)
WITH CHECK (
  public.can_manage_occurrence_ticket(auth.uid(), ticket_id)
  OR EXISTS (
    SELECT 1
    FROM public.occurrence_tickets ot
    WHERE ot.id = ticket_id
      AND ot.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Assigned users and managers can manage sector assignments" ON public.occurrence_ticket_sector_assignments;

CREATE POLICY "Ticket creators assigned users and managers can manage sector assignments"
ON public.occurrence_ticket_sector_assignments
FOR ALL
TO authenticated
USING (
  public.can_manage_occurrence_ticket(auth.uid(), ticket_id)
  OR EXISTS (
    SELECT 1
    FROM public.occurrence_tickets ot
    WHERE ot.id = ticket_id
      AND ot.created_by = auth.uid()
  )
)
WITH CHECK (
  public.can_manage_occurrence_ticket(auth.uid(), ticket_id)
  OR EXISTS (
    SELECT 1
    FROM public.occurrence_tickets ot
    WHERE ot.id = ticket_id
      AND ot.created_by = auth.uid()
  )
);