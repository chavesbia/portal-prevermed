-- Módulo próprio para gestão de comunicados (independente de Administração)
INSERT INTO public.modules (name, description, icon, route, is_active)
SELECT 'Comunicados (Gestão)', 'Publicação e gestão de comunicados internos', 'Megaphone', '/gestao-comunicados', true
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE route = '/gestao-comunicados');

-- Permitir que usuários com permissão nesse módulo gerenciem comunicados
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
CREATE POLICY "Managers can insert announcements"
ON public.announcements FOR INSERT TO authenticated
WITH CHECK (is_admin() OR public.can_edit_module_route(auth.uid(), '/gestao-comunicados'));

DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
CREATE POLICY "Managers can update announcements"
ON public.announcements FOR UPDATE TO authenticated
USING (is_admin() OR public.can_edit_module_route(auth.uid(), '/gestao-comunicados'));

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
CREATE POLICY "Managers can delete announcements"
ON public.announcements FOR DELETE TO authenticated
USING (is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-comunicados'));

DROP POLICY IF EXISTS "Authenticated can view public announcements" ON public.announcements;
CREATE POLICY "Authenticated can view announcements"
ON public.announcements FOR SELECT TO authenticated
USING (
  is_public = true
  OR is_adm_master()
  OR public.can_view_module_route(auth.uid(), '/gestao-comunicados')
  OR (department_id IS NOT NULL AND is_user_in_department(auth.uid(), department_id))
);
