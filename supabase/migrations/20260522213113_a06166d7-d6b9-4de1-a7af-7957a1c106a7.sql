
-- 1) lookup_email_by_login RPC
CREATE OR REPLACE FUNCTION public.lookup_email_by_login(p_login text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE login = lower(btrim(p_login))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lookup_email_by_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_email_by_login(text) TO anon, authenticated;

-- 2) Restrict profiles SELECT to authenticated only
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3) Remove chat module
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_participants CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP FUNCTION IF EXISTS public.is_user_in_chat(uuid, uuid);

-- 4) Documents: add file_path, backfill, make bucket private
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_path text;

UPDATE public.documents
SET file_path = regexp_replace(file_url, '^.*/storage/v1/object/(?:public|sign)/documents/', '')
WHERE file_path IS NULL AND file_url ~ '/storage/v1/object/(?:public|sign)/documents/';

UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- Replace storage policies for documents bucket
DROP POLICY IF EXISTS "Everyone can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

CREATE POLICY "Authenticated users can read documents bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "ADM Master can upload documents bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.is_adm_master());

CREATE POLICY "ADM Master can update documents bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND public.is_adm_master());

CREATE POLICY "ADM Master can delete documents bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND public.is_adm_master());

-- 5) Tighten RLS on sensitive tables
DROP POLICY IF EXISTS "Authenticated users can view aso_atendimentos" ON public.aso_atendimentos;
CREATE POLICY "Authorized users can view aso_atendimentos"
  ON public.aso_atendimentos FOR SELECT
  TO authenticated
  USING (
    public.is_adm_master()
    OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
      WHERE m.module_route LIKE '/liberacao-asos%' AND m.can_view = true
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view commercial_clients" ON public.commercial_clients;
CREATE POLICY "Authorized users can view commercial_clients"
  ON public.commercial_clients FOR SELECT
  TO authenticated
  USING (
    public.is_adm_master()
    OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
      WHERE m.module_route = '/carteira-comercial' AND m.can_view = true
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view active services" ON public.services;
CREATE POLICY "Authorized users can view services"
  ON public.services FOR SELECT
  TO authenticated
  USING (
    public.is_adm_master()
    OR (
      is_active = true AND EXISTS (
        SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) m
        WHERE m.module_route = '/precificacao' AND m.can_view = true
      )
    )
  );

-- 6) get_user_accessible_modules: remove unconditional /gestao-ocorrencias access
CREATE OR REPLACE FUNCTION public.get_user_accessible_modules(_user_id uuid)
 RETURNS TABLE(module_id uuid, module_name text, module_route text, module_icon text, department_id uuid, department_name text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean, can_approve boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    m.id, m.name, m.route, m.icon,
    d.id, d.name,
    true, true, true, true, true
  FROM public.department_modules dm
  JOIN public.modules m ON m.id = dm.module_id AND m.is_active = true
  JOIN public.departments d ON d.id = dm.department_id
  WHERE public.has_role(_user_id, 'adm_master')

  UNION ALL

  SELECT 
    m.id, m.name, m.route, m.icon,
    d.id, d.name,
    COALESCE(p.can_view, false),
    COALESCE(p.can_create, false),
    COALESCE(p.can_edit, false),
    COALESCE(p.can_delete, false),
    COALESCE(p.can_approve, false)
  FROM public.permissions p
  JOIN public.modules m ON m.id = p.module_id AND m.is_active = true
  JOIN public.department_modules dm ON dm.module_id = m.id
  JOIN public.departments d ON d.id = dm.department_id
  JOIN public.user_departments ud ON ud.department_id = d.id AND ud.user_id = _user_id
  WHERE p.user_id = _user_id
    AND COALESCE(p.can_view, false) = true
    AND NOT public.has_role(_user_id, 'adm_master')
$function$;
