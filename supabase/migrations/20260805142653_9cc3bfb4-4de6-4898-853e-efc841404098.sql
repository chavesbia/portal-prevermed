-- Fix for company_units_update
DROP POLICY IF EXISTS "company_units_update" ON public.company_units;
CREATE POLICY "company_units_update" ON public.company_units FOR UPDATE TO authenticated USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'::text));

-- Fix for company_contacts_update
DROP POLICY IF EXISTS "company_contacts_update" ON public.company_contacts;
CREATE POLICY "company_contacts_update" ON public.company_contacts FOR UPDATE TO authenticated USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'::text));

-- Fix for company_pricing_items_update
DROP POLICY IF EXISTS "company_pricing_items_update" ON public.company_pricing_items;
CREATE POLICY "company_pricing_items_update" ON public.company_pricing_items FOR UPDATE TO authenticated USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'::text));

-- Fix for company_responsaveis_pcmso_update
DROP POLICY IF EXISTS "company_responsaveis_pcmso_update" ON public.company_responsaveis_pcmso;
CREATE POLICY "company_responsaveis_pcmso_update" ON public.company_responsaveis_pcmso FOR UPDATE TO authenticated USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'::text));

-- Fix for contract_clientes cc_update
DROP POLICY IF EXISTS "cc_update" ON public.contract_clientes;
CREATE POLICY "cc_update" ON public.contract_clientes FOR UPDATE TO authenticated USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-contratual'::text));

-- Fix for contract_templates ct_view
DROP POLICY IF EXISTS "ct_view" ON public.contract_templates;
CREATE POLICY "ct_view" ON public.contract_templates FOR SELECT TO authenticated USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-contratual'::text));

-- Fix for contract_template_versions ctv_view
DROP POLICY IF EXISTS "ctv_view" ON public.contract_template_versions;
CREATE POLICY "ctv_view" ON public.contract_template_versions FOR SELECT TO authenticated USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-contratual'::text));

-- Fix for contract_contratos contract_contratos_select_painel
DROP POLICY IF EXISTS "contract_contratos_select_painel" ON public.contract_contratos;
CREATE POLICY "contract_contratos_select_painel" ON public.contract_contratos FOR SELECT TO authenticated USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-contratual'::text) OR can_view_module_route(auth.uid(), '/painel-cliente'::text));

-- Fix for contract_clientes contract_clientes_select_painel
DROP POLICY IF EXISTS "contract_clientes_select_painel" ON public.contract_clientes;
CREATE POLICY "contract_clientes_select_painel" ON public.contract_clientes FOR SELECT TO authenticated USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-contratual'::text) OR can_view_module_route(auth.uid(), '/painel-cliente'::text));

-- Fix for contract_contratos ck_update
DROP POLICY IF EXISTS "ck_update" ON public.contract_contratos;
CREATE POLICY "ck_update" ON public.contract_contratos FOR UPDATE TO authenticated USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-contratual'::text));

-- Fix for contract_templates ct_update
DROP POLICY IF EXISTS "ct_update" ON public.contract_templates;
CREATE POLICY "ct_update" ON public.contract_templates FOR UPDATE TO authenticated USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-contratual'::text));

-- Fix for contract_assinaturas ca_view
DROP POLICY IF EXISTS "ca_view" ON public.contract_assinaturas;
CREATE POLICY "ca_view" ON public.contract_assinaturas FOR SELECT TO authenticated USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-contratual'::text));

-- Fix for contract_assinaturas ca_update
DROP POLICY IF EXISTS "ca_update" ON public.contract_assinaturas;
CREATE POLICY "ca_update" ON public.contract_assinaturas FOR UPDATE TO authenticated USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-contratual'::text));

-- Fix for contract_contratos INSERT (Check for existing and drop if needed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_contratos' AND policyname = 'Only admins or authorized users can insert contracts') THEN
        DROP POLICY "Only admins or authorized users can insert contracts" ON public.contract_contratos;
    END IF;
END $$;
CREATE POLICY "Only admins or authorized users can insert contracts" ON public.contract_contratos FOR INSERT TO authenticated WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-contratual'::text));

-- Fix for contract_clientes INSERT
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_clientes' AND policyname = 'Only admins or authorized users can insert clients') THEN
        DROP POLICY "Only admins or authorized users can insert clients" ON public.contract_clientes;
    END IF;
END $$;
CREATE POLICY "Only admins or authorized users can insert clients" ON public.contract_clientes FOR INSERT TO authenticated WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-contratual'::text));
