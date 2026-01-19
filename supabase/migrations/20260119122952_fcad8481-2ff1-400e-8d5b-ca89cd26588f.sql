-- =====================================================
-- SECURITY FIXES
-- =====================================================

-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public;

-- Drop the overly permissive audit_log INSERT policy and create a more restrictive one
DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Drop the overly permissive notifications INSERT policy and create a more restrictive one
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" ON public.notifications 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

-- Add search_path to handle_new_user function (already has it but let's be explicit)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;