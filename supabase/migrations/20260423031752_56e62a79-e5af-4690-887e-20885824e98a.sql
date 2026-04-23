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
    m.id,
    m.name,
    m.route,
    m.icon,
    d.id,
    d.name,
    true,
    true,
    false,
    false,
    false
  FROM public.department_modules dm
  JOIN public.modules m ON m.id = dm.module_id AND m.is_active = true
  JOIN public.departments d ON d.id = dm.department_id
  WHERE m.route = '/gestao-ocorrencias'

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
    AND m.route <> '/gestao-ocorrencias'
$function$;