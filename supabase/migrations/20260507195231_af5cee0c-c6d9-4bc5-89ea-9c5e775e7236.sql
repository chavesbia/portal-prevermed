-- Remove órfão Mariana Camargo (sem profile) e seus dados associados
DO $$
DECLARE
  _uid uuid := '25d53366-4945-4784-8293-8482cc7d8e40';
BEGIN
  DELETE FROM public.permission_template_shadow WHERE permission_id IN (SELECT id FROM public.permissions WHERE user_id = _uid);
  DELETE FROM public.permissions WHERE user_id = _uid;
  DELETE FROM public.user_module_access WHERE user_id = _uid;
  DELETE FROM public.user_departments WHERE user_id = _uid;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.notifications WHERE user_id = _uid;
  DELETE FROM public.chat_participants WHERE user_id = _uid;
  DELETE FROM public.module_sessions WHERE user_id = _uid;
  DELETE FROM public.document_users WHERE user_id = _uid;
  DELETE FROM public.post_likes WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE user_id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END $$;