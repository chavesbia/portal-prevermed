
DROP POLICY IF EXISTS "Admins can insert ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "Admins can update ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "Admins can delete ordens_servico" ON public.ordens_servico;

CREATE POLICY "Editors can insert ordens_servico" ON public.ordens_servico
  FOR INSERT TO authenticated
  WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "Editors can update ordens_servico" ON public.ordens_servico
  FOR UPDATE TO authenticated
  USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "Editors can delete ordens_servico" ON public.ordens_servico
  FOR DELETE TO authenticated
  USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));

-- Same for related tables
DROP POLICY IF EXISTS "Admins can insert servicos_os" ON public.servicos_os;
DROP POLICY IF EXISTS "Admins can update servicos_os" ON public.servicos_os;
DROP POLICY IF EXISTS "Admins can delete servicos_os" ON public.servicos_os;

CREATE POLICY "Editors can insert servicos_os" ON public.servicos_os
  FOR INSERT TO authenticated
  WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));
CREATE POLICY "Editors can update servicos_os" ON public.servicos_os
  FOR UPDATE TO authenticated
  USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));
CREATE POLICY "Editors can delete servicos_os" ON public.servicos_os
  FOR DELETE TO authenticated
  USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));
