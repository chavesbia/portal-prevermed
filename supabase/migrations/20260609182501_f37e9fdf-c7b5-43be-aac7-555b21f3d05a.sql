
-- Helper: can_view_module_route
CREATE OR REPLACE FUNCTION public.can_view_module_route(_user_id uuid, _route text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(_user_id) gum
    WHERE gum.module_route = _route AND gum.can_view = true
  )
$$;

-- 1. Public-readable metadata tables -> authenticated only
DROP POLICY IF EXISTS "Everyone can view modules" ON public.modules;
CREATE POLICY "Authenticated can view modules" ON public.modules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view departments" ON public.departments;
CREATE POLICY "Authenticated can view departments" ON public.departments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view department_modules" ON public.department_modules;
CREATE POLICY "Authenticated can view department_modules" ON public.department_modules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view user departments" ON public.user_departments;
CREATE POLICY "Authenticated can view user departments" ON public.user_departments
  FOR SELECT TO authenticated USING (true);

-- 2. Commercial tables -> require /carteira-comercial access
DROP POLICY IF EXISTS "Authenticated can view client_services" ON public.commercial_client_services;
CREATE POLICY "Authorized users can view client_services"
  ON public.commercial_client_services FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/carteira-comercial'));

DROP POLICY IF EXISTS "Authenticated can view client_service_modules" ON public.commercial_client_service_modules;
CREATE POLICY "Authorized users can view client_service_modules"
  ON public.commercial_client_service_modules FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/carteira-comercial'));

DROP POLICY IF EXISTS "Authenticated can view service_components" ON public.commercial_service_components;
CREATE POLICY "Authorized users can view service_components"
  ON public.commercial_service_components FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/carteira-comercial'));

DROP POLICY IF EXISTS "Authenticated can view commercial_services" ON public.commercial_services;
CREATE POLICY "Authorized users can view commercial_services"
  ON public.commercial_services FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/carteira-comercial'));

-- 3. Guias tables -> require /gestao-guias access
DROP POLICY IF EXISTS "Authenticated users can view guias" ON public.guias;
CREATE POLICY "Authorized users can view guias"
  ON public.guias FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-guias'));

DROP POLICY IF EXISTS "Authenticated users can view guia_exames" ON public.guia_exames;
CREATE POLICY "Authorized users can view guia_exames"
  ON public.guia_exames FOR SELECT TO authenticated
  USING (public.is_adm_master() OR public.can_view_module_route(auth.uid(), '/gestao-guias'));

-- 4. ASO fechamento itens -> require any /liberacao-asos* access
DROP POLICY IF EXISTS "Authenticated users can view fechamento itens" ON public.aso_fechamento_itens;
CREATE POLICY "Authorized users can view fechamento itens"
  ON public.aso_fechamento_itens FOR SELECT TO authenticated
  USING (
    public.is_adm_master() OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
      WHERE gum.module_route LIKE '/liberacao-asos%' AND gum.can_view = true
    )
  );

-- 5. Responsáveis técnicos -> require /gestao-os or any /liberacao-asos* access
DROP POLICY IF EXISTS "Authenticated users can view responsaveis_tecnicos" ON public.responsaveis_tecnicos;
CREATE POLICY "Authorized users can view responsaveis_tecnicos"
  ON public.responsaveis_tecnicos FOR SELECT TO authenticated
  USING (
    public.is_adm_master() OR EXISTS (
      SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
      WHERE (gum.module_route = '/gestao-os' OR gum.module_route LIKE '/liberacao-asos%')
        AND gum.can_view = true
    )
  );

-- 6. Occurrence tickets -> restrict SELECT to creator/assignees/managers
DROP POLICY IF EXISTS "Authenticated users can view occurrence tickets" ON public.occurrence_tickets;
CREATE POLICY "Involved users can view occurrence tickets"
  ON public.occurrence_tickets FOR SELECT TO authenticated
  USING (
    public.is_occurrence_manager(auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.occurrence_ticket_assignees ota
      WHERE ota.ticket_id = occurrence_tickets.id
        AND ota.user_id = auth.uid()
        AND ota.is_active = true
    )
  );

-- 7. Fix can_access_occurrence_attachment logic flaw
CREATE OR REPLACE FUNCTION public.can_access_occurrence_attachment(_ticket_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_occurrence_manager(auth.uid())
    OR public.can_manage_occurrence_ticket(auth.uid(), _ticket_id)
    OR EXISTS (
      SELECT 1 FROM public.occurrence_tickets ot
      WHERE ot.id = _ticket_id AND ot.created_by = auth.uid()
    )
  );
$$;
