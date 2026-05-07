
DO $$
DECLARE
  orphan_ids uuid[] := ARRAY[
    '702fb0c2-0000-0000-0000-000000000000'::uuid -- placeholder, will replace
  ];
BEGIN
  -- Resolve actual IDs from auth.users by email
  SELECT array_agg(id) INTO orphan_ids
  FROM auth.users
  WHERE email IN (
    'nicolly.guedes@prevermed.com.br',
    'esousa@prevermed.internal',
    'jsantos@prevermed.internal',
    'lbrito@prevermed.internal',
    'kpriosta@prevermed.internal'
  );

  IF orphan_ids IS NULL OR array_length(orphan_ids, 1) = 0 THEN
    RAISE NOTICE 'Nenhum usuário órfão encontrado.';
    RETURN;
  END IF;

  DELETE FROM public.permission_template_shadow WHERE permission_id IN (SELECT id FROM public.permissions WHERE user_id = ANY(orphan_ids));
  DELETE FROM public.permissions WHERE user_id = ANY(orphan_ids);
  DELETE FROM public.user_module_access WHERE user_id = ANY(orphan_ids);
  DELETE FROM public.user_departments WHERE user_id = ANY(orphan_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(orphan_ids);
  DELETE FROM public.notifications WHERE user_id = ANY(orphan_ids);
  DELETE FROM public.chat_participants WHERE user_id = ANY(orphan_ids);
  DELETE FROM public.profiles WHERE user_id = ANY(orphan_ids);
  DELETE FROM auth.users WHERE id = ANY(orphan_ids);

  RAISE NOTICE 'Removidas % contas órfãs.', array_length(orphan_ids, 1);
END $$;
