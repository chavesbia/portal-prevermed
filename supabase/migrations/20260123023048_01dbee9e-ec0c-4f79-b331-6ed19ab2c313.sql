-- Drop existing restrictive policies on user_roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_adm_master());

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_adm_master());

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_adm_master());

-- Drop existing restrictive policies on user_departments
DROP POLICY IF EXISTS "Admins can insert user departments" ON public.user_departments;
DROP POLICY IF EXISTS "Admins can update user departments" ON public.user_departments;
DROP POLICY IF EXISTS "Admins can delete user departments" ON public.user_departments;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Admins can insert user departments"
ON public.user_departments
FOR INSERT
TO authenticated
WITH CHECK (public.is_adm_master());

CREATE POLICY "Admins can update user departments"
ON public.user_departments
FOR UPDATE
TO authenticated
USING (public.is_adm_master());

CREATE POLICY "Admins can delete user departments"
ON public.user_departments
FOR DELETE
TO authenticated
USING (public.is_adm_master());