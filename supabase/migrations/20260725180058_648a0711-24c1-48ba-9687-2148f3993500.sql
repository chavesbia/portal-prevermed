CREATE OR REPLACE FUNCTION public.get_user_accessible_modules(_user_id uuid)
 RETURNS TABLE(module_id uuid, module_name text, module_route text, module_icon text, department_id uuid, department_name text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean, can_approve boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- ADM Master: acesso total a todos os módulos ativos, sem depender de department_modules
  SELECT
    m.id AS module_id,
    m.name AS module_name,
    m.route AS module_route,
    m.icon AS module_icon,
    d.id AS department_id,
    d.name AS department_name,
    true, true, true, true, true
  FROM public.modules m
  LEFT JOIN LATERAL (
    SELECT d.id, d.name
    FROM public.department_modules dm
    JOIN public.departments d ON d.id = dm.department_id
    WHERE dm.module_id = m.id
    ORDER BY d.name
    LIMIT 1
  ) d ON true
  WHERE m.is_active = true
    AND public.has_role(_user_id, 'adm_master')

  UNION ALL

  -- Demais usuários: acesso decidido SOMENTE por permissions.can_view = true.
  -- Departamento (se houver vínculo) é apenas informativo.
  SELECT
    m.id AS module_id,
    m.name AS module_name,
    m.route AS module_route,
    m.icon AS module_icon,
    d.id AS department_id,
    d.name AS department_name,
    COALESCE(p.can_view, false),
    COALESCE(p.can_create, false),
    COALESCE(p.can_edit, false),
    COALESCE(p.can_delete, false),
    COALESCE(p.can_approve, false)
  FROM public.permissions p
  JOIN public.modules m ON m.id = p.module_id AND m.is_active = true
  LEFT JOIN LATERAL (
    SELECT d.id, d.name
    FROM public.department_modules dm
    JOIN public.departments d ON d.id = dm.department_id
    WHERE dm.module_id = m.id
    ORDER BY d.name
    LIMIT 1
  ) d ON true
  WHERE p.user_id = _user_id
    AND COALESCE(p.can_view, false) = true
    AND NOT public.has_role(_user_id, 'adm_master');
$function$;