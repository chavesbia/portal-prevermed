-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "laudos_select_policy" ON public.laudos;
DROP POLICY IF EXISTS "ordens_servico_select_policy" ON public.ordens_servico;
DROP POLICY IF EXISTS "contract_clientes_select_policy" ON public.contract_clientes;
DROP POLICY IF EXISTS "ck_view" ON public.contract_contratos;
DROP POLICY IF EXISTS "OS viewers can view servicos_os" ON public.servicos_os;
DROP POLICY IF EXISTS "Visualizar visitas com acesso ao módulo OS" ON public.os_visitas;
DROP POLICY IF EXISTS "OS viewers can view laudos" ON public.laudos;
DROP POLICY IF EXISTS "OS viewers can view ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "cc_view" ON public.contract_clientes;

-- 1. Update laudos
CREATE POLICY "laudos_select_painel" ON public.laudos
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-os') OR 
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- 2. Update ordens_servico
CREATE POLICY "ordens_servico_select_painel" ON public.ordens_servico
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-os') OR 
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- 3. Update contract_contratos (Contratos card)
CREATE POLICY "contract_contratos_select_painel" ON public.contract_contratos
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-contratual/contratos') OR 
  can_view_module_route(auth.uid(), '/gestao-contratual') OR
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- 4. Update contract_clientes (Required for Contratos query in Painel)
CREATE POLICY "contract_clientes_select_painel" ON public.contract_clientes
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-contratual/clientes') OR 
  can_view_module_route(auth.uid(), '/gestao-contratual') OR
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- 5. Update servicos_os (Often queried with OS)
CREATE POLICY "servicos_os_select_painel" ON public.servicos_os
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-os') OR 
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- 6. Update os_visitas (Scheduling visibility)
CREATE POLICY "os_visitas_select_painel" ON public.os_visitas
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-os') OR 
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- Explicitly grant SELECT to authenticated users for these tables
GRANT SELECT ON public.laudos TO authenticated;
GRANT SELECT ON public.ordens_servico TO authenticated;
GRANT SELECT ON public.contract_contratos TO authenticated;
GRANT SELECT ON public.contract_clientes TO authenticated;
GRANT SELECT ON public.servicos_os TO authenticated;
GRANT SELECT ON public.os_visitas TO authenticated;
