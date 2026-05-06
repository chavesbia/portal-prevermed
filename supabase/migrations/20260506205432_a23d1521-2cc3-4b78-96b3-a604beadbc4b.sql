
-- 1. Limpeza de órfãos em user_departments
DELETE FROM public.user_departments ud
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = ud.user_id
);

-- 2. Tabela de templates de roles (para futura migração RBAC)
CREATE TABLE IF NOT EXISTS public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view role templates"
ON public.role_templates FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Only adm_master can insert role templates"
ON public.role_templates FOR INSERT
TO authenticated WITH CHECK (public.is_adm_master());

CREATE POLICY "Only adm_master can update role templates"
ON public.role_templates FOR UPDATE
TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

CREATE POLICY "Only adm_master can delete role templates"
ON public.role_templates FOR DELETE
TO authenticated USING (public.is_adm_master());

CREATE TRIGGER trg_role_templates_updated_at
BEFORE UPDATE ON public.role_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed dos 3 modelos base
INSERT INTO public.role_templates (slug, name, description, can_view, can_create, can_edit, can_delete, can_approve)
VALUES
  ('viewer', 'Visualizador', 'Apenas leitura do módulo.', true, false, false, false, false),
  ('operator', 'Operador', 'Pode criar e editar registros, sem aprovar nem excluir.', true, true, true, false, false),
  ('approver', 'Aprovador', 'Pode criar, editar, aprovar e excluir registros.', true, true, true, true, true)
ON CONFLICT (slug) DO NOTHING;
