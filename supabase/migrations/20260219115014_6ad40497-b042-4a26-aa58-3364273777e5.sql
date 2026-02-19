
-- Add folder column to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS folder text DEFAULT NULL;

-- Create document_departments junction table for multi-department support
CREATE TABLE IF NOT EXISTS public.document_departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(document_id, department_id)
);

ALTER TABLE public.document_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view document departments" ON public.document_departments
FOR SELECT USING (true);

CREATE POLICY "Admins can insert document departments" ON public.document_departments
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete document departments" ON public.document_departments
FOR DELETE USING (public.is_admin());

CREATE POLICY "Admins can update document departments" ON public.document_departments
FOR UPDATE USING (public.is_admin());

-- Create document_users junction table for user-specific access
CREATE TABLE IF NOT EXISTS public.document_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);

ALTER TABLE public.document_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view document users" ON public.document_users
FOR SELECT USING (true);

CREATE POLICY "Admins can insert document users" ON public.document_users
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete document users" ON public.document_users
FOR DELETE USING (public.is_admin());

CREATE POLICY "Admins can update document users" ON public.document_users
FOR UPDATE USING (public.is_admin());

-- Update documents RLS policy to support multi-department and user-specific access
DROP POLICY IF EXISTS "Everyone can view public documents" ON public.documents;

CREATE POLICY "Everyone can view accessible documents" ON public.documents
FOR SELECT USING (
  (is_public = true) 
  OR is_adm_master() 
  OR EXISTS (
    SELECT 1 FROM public.document_departments dd 
    JOIN public.user_departments ud ON ud.department_id = dd.department_id 
    WHERE dd.document_id = documents.id AND ud.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.document_users du 
    WHERE du.document_id = documents.id AND du.user_id = auth.uid()
  )
);
