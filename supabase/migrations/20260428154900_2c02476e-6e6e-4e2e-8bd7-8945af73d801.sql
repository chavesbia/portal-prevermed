-- 1. Corrigir RLS de documents: somente ADM Master pode criar/editar/excluir
DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;

CREATE POLICY "ADM Master can insert documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master());

CREATE POLICY "ADM Master can update documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (public.is_adm_master());

-- 2. Tabela imutável para registrar tentativas de acesso administrativo indevido
CREATE TABLE IF NOT EXISTS public.unauthorized_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  user_role text,
  attempted_resource text NOT NULL,
  attempt_source text NOT NULL,
  http_method text,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unauthorized_access_log ENABLE ROW LEVEL SECURITY;

-- Apenas ADM Master pode visualizar
CREATE POLICY "ADM Master can view unauthorized access log"
  ON public.unauthorized_access_log FOR SELECT TO authenticated
  USING (public.is_adm_master());

-- Qualquer usuário autenticado pode registrar sua própria tentativa
CREATE POLICY "Authenticated users can log own attempts"
  ON public.unauthorized_access_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Imutável: nenhum UPDATE/DELETE permitido (sem políticas = bloqueado)

CREATE INDEX IF NOT EXISTS idx_unauthorized_access_log_created_at ON public.unauthorized_access_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unauthorized_access_log_user_id ON public.unauthorized_access_log(user_id);

-- 3. Função RPC para registrar tentativa de acesso indevido (uso no frontend e edge functions)
CREATE OR REPLACE FUNCTION public.log_unauthorized_access(
  _resource text,
  _source text,
  _method text DEFAULT NULL,
  _details jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text;
  _role text;
  _id uuid;
BEGIN
  IF _user_id IS NOT NULL THEN
    SELECT email INTO _email FROM public.profiles WHERE user_id = _user_id LIMIT 1;
    SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  END IF;

  INSERT INTO public.unauthorized_access_log (
    user_id, user_email, user_role, attempted_resource, attempt_source, http_method, details
  ) VALUES (
    _user_id, _email, _role, _resource, _source, _method, _details
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_unauthorized_access(text, text, text, jsonb) TO authenticated, anon;