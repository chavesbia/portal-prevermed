
-- 1. Create department_modules linking table
CREATE TABLE IF NOT EXISTS public.department_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(department_id, module_id)
);

ALTER TABLE public.department_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view department_modules" ON public.department_modules
  FOR SELECT TO public USING (true);

CREATE POLICY "ADM Master can insert department_modules" ON public.department_modules
  FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());

CREATE POLICY "ADM Master can update department_modules" ON public.department_modules
  FOR UPDATE TO authenticated USING (public.is_adm_master());

CREATE POLICY "ADM Master can delete department_modules" ON public.department_modules
  FOR DELETE TO authenticated USING (public.is_adm_master());

-- 2. Insert Gestão de Guias module if not exists
INSERT INTO public.modules (name, description, route, icon, is_active, app_type)
SELECT 'Gestão de Guias', 'Controle operacional de guias do SOC', '/gestao-guias', 'ClipboardList', true, 'internal'
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE name = 'Gestão de Guias');

-- 3. Update Precificação module with route and icon
UPDATE public.modules SET route = '/precificacao', icon = 'Calculator', app_type = 'internal'
WHERE name = 'Precificação';

-- 4. Seed department_modules links
INSERT INTO public.department_modules (department_id, module_id)
SELECT d.id, m.id FROM public.departments d, public.modules m
WHERE d.name = 'Comercial' AND m.name = 'Precificação'
ON CONFLICT (department_id, module_id) DO NOTHING;

INSERT INTO public.department_modules (department_id, module_id)
SELECT d.id, m.id FROM public.departments d, public.modules m
WHERE d.name = 'Credenciamento' AND m.name = 'Gestão de Guias'
ON CONFLICT (department_id, module_id) DO NOTHING;

-- 5. Function: get all accessible modules for a user (used by sidebar and permission checks)
CREATE OR REPLACE FUNCTION public.get_user_accessible_modules(_user_id uuid)
RETURNS TABLE(
  module_id uuid,
  module_name text,
  module_route text,
  module_icon text,
  department_id uuid,
  department_name text,
  can_view boolean,
  can_create boolean,
  can_edit boolean,
  can_delete boolean,
  can_approve boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- ADM_MASTER gets full access to all active modules in all departments
  SELECT 
    m.id, m.name, m.route, m.icon,
    d.id, d.name,
    true, true, true, true, true
  FROM public.department_modules dm
  JOIN public.modules m ON m.id = dm.module_id AND m.is_active = true
  JOIN public.departments d ON d.id = dm.department_id
  WHERE public.has_role(_user_id, 'adm_master')

  UNION ALL

  -- Regular users: only modules with explicit permissions + must be in the department
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
$$;
