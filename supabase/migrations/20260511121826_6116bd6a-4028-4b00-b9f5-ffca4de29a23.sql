CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.has_role(auth.uid(), 'adm_master')
      OR public.has_role(auth.uid(), 'adm_user')
$function$;

DROP POLICY IF EXISTS "Admins can insert guia_gestao" ON public.guia_gestao;
DROP POLICY IF EXISTS "Admins can update guia_gestao" ON public.guia_gestao;

CREATE POLICY "Guias editors can insert guia_gestao"
ON public.guia_gestao
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-guias')
);

CREATE POLICY "Guias editors can update guia_gestao"
ON public.guia_gestao
FOR UPDATE
TO authenticated
USING (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-guias')
)
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-guias')
);