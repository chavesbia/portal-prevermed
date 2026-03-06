
-- ==============================================
-- ETAPA 1: Ecossistema de Módulos Centralizados
-- ==============================================

-- 1) Criar enum para tipo de aplicação do módulo
CREATE TYPE public.module_app_type AS ENUM ('internal', 'external', 'iframe');

-- 2) Alterar tabela modules - adicionar campos para ecossistema
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS app_type public.module_app_type DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS requires_permission boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 3) Criar tabela user_module_access (controle de acesso por usuário a módulos)
CREATE TABLE public.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);

-- 4) Criar tabela module_sessions (auditoria de acessos aos módulos)
CREATE TABLE public.module_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- 5) Habilitar RLS
ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sessions ENABLE ROW LEVEL SECURITY;

-- 6) RLS para user_module_access
-- ADM Master gerencia tudo
CREATE POLICY "Admins can manage module access"
  ON public.user_module_access FOR ALL
  TO authenticated
  USING (public.is_adm_master())
  WITH CHECK (public.is_adm_master());

-- Usuários veem seus próprios acessos
CREATE POLICY "Users can view own module access"
  ON public.user_module_access FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 7) RLS para module_sessions
-- ADM Master vê tudo
CREATE POLICY "Admins can view all sessions"
  ON public.module_sessions FOR SELECT
  TO authenticated
  USING (public.is_adm_master());

-- Usuários veem próprias sessões
CREATE POLICY "Users can view own sessions"
  ON public.module_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Qualquer autenticado pode registrar sessão própria
CREATE POLICY "Users can insert own sessions"
  ON public.module_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 8) Função para verificar acesso a módulo
CREATE OR REPLACE FUNCTION public.user_has_module_access(_user_id uuid, _module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_module_access
    WHERE user_id = _user_id
      AND module_id = _module_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
  OR public.has_role(_user_id, 'adm_master')
$$;

-- 9) Índices para performance
CREATE INDEX idx_user_module_access_user ON public.user_module_access(user_id);
CREATE INDEX idx_user_module_access_module ON public.user_module_access(module_id);
CREATE INDEX idx_module_sessions_user ON public.module_sessions(user_id);
CREATE INDEX idx_module_sessions_module ON public.module_sessions(module_id);
CREATE INDEX idx_module_sessions_started ON public.module_sessions(started_at DESC);
