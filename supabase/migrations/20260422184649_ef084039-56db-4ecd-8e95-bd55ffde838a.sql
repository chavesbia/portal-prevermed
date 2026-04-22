CREATE OR REPLACE FUNCTION public.can_edit_module_route(_user_id uuid, _route text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.get_user_accessible_modules(_user_id) gum
    WHERE gum.module_route = _route
      AND gum.can_edit = true
  )
$$;

DROP POLICY IF EXISTS "Admins can update aso_exames" ON public.aso_exames_atendimento;

CREATE POLICY "Authorized users can update aso_exames"
ON public.aso_exames_atendimento
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem')
)
WITH CHECK (
  public.is_admin()
  OR public.can_edit_module_route(auth.uid(), '/liberacao-asos/enfermagem')
);