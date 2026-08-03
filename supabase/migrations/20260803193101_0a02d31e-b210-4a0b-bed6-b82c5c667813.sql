-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "OS viewers can view laudos" ON public.laudos;
DROP POLICY IF EXISTS "OS viewers can view ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "cc_view" ON public.contract_clientes;

-- 1. Update laudos SELECT policy
CREATE POLICY "laudos_select_policy" ON public.laudos
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-os') OR 
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- 2. Update ordens_servico SELECT policy
CREATE POLICY "ordens_servico_select_policy" ON public.ordens_servico
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-os') OR 
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- 3. Update contract_clientes SELECT policy (since it feeds the Contracts card)
CREATE POLICY "contract_clientes_select_policy" ON public.contract_clientes
FOR SELECT TO authenticated
USING (
  is_adm_master() OR 
  can_view_module_route(auth.uid(), '/gestao-contratual/clientes') OR 
  can_view_module_route(auth.uid(), '/gestao-contratual') OR
  can_view_module_route(auth.uid(), '/painel-cliente')
);

-- Note: company_responsaveis_pcmso and company_pricing_items are already set to 'true' for authenticated users, 
-- which is even broader than requested, so no change needed there to keep them working.

-- Re-verify grants just in case
GRANT SELECT ON public.laudos TO authenticated;
GRANT SELECT ON public.ordens_servico TO authenticated;
GRANT SELECT ON public.contract_clientes TO authenticated;
