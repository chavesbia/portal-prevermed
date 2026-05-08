
CREATE OR REPLACE FUNCTION public.classify_permission_shadow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  best_template_id uuid;
  best_diff_count int := 99;
  best_match_type text := 'closest';
  tpl record;
  diff_count int;
  diff_obj jsonb;
  existing record;
BEGIN
  -- Encontrar o template mais próximo
  FOR tpl IN SELECT id, can_view, can_create, can_edit, can_delete, can_approve FROM public.role_templates LOOP
    diff_count := 0;
    IF tpl.can_view IS DISTINCT FROM NEW.can_view THEN diff_count := diff_count + 1; END IF;
    IF tpl.can_create IS DISTINCT FROM NEW.can_create THEN diff_count := diff_count + 1; END IF;
    IF tpl.can_edit IS DISTINCT FROM NEW.can_edit THEN diff_count := diff_count + 1; END IF;
    IF tpl.can_delete IS DISTINCT FROM NEW.can_delete THEN diff_count := diff_count + 1; END IF;
    IF tpl.can_approve IS DISTINCT FROM NEW.can_approve THEN diff_count := diff_count + 1; END IF;

    IF diff_count < best_diff_count THEN
      best_diff_count := diff_count;
      best_template_id := tpl.id;
    END IF;
  END LOOP;

  IF best_template_id IS NULL THEN
    RETURN NEW; -- sem templates configurados
  END IF;

  -- Construir o diff e match_type
  IF best_diff_count = 0 THEN
    best_match_type := 'exact';
    diff_obj := NULL;
  ELSE
    best_match_type := 'closest';
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'can_view',    CASE WHEN tpl.can_view    IS DISTINCT FROM NEW.can_view    THEN jsonb_build_object('current', NEW.can_view,    'template', tpl.can_view)    END,
      'can_create',  CASE WHEN tpl.can_create  IS DISTINCT FROM NEW.can_create  THEN jsonb_build_object('current', NEW.can_create,  'template', tpl.can_create)  END,
      'can_edit',    CASE WHEN tpl.can_edit    IS DISTINCT FROM NEW.can_edit    THEN jsonb_build_object('current', NEW.can_edit,    'template', tpl.can_edit)    END,
      'can_delete',  CASE WHEN tpl.can_delete  IS DISTINCT FROM NEW.can_delete  THEN jsonb_build_object('current', NEW.can_delete,  'template', tpl.can_delete)  END,
      'can_approve', CASE WHEN tpl.can_approve IS DISTINCT FROM NEW.can_approve THEN jsonb_build_object('current', NEW.can_approve, 'template', tpl.can_approve) END
    ))
    INTO diff_obj
    FROM public.role_templates tpl
    WHERE tpl.id = best_template_id;
  END IF;

  SELECT * INTO existing FROM public.permission_template_shadow WHERE permission_id = NEW.id;

  IF existing.id IS NULL THEN
    -- Sem shadow: cria como pendente
    INSERT INTO public.permission_template_shadow
      (permission_id, template_id, match_type, diff, review_status, computed_at)
    VALUES (NEW.id, best_template_id, best_match_type, diff_obj, 'pending', now());
  ELSIF existing.review_status = 'approved'
        AND existing.template_id = best_template_id
        AND best_match_type = 'exact' THEN
    -- Continua aprovado e exato: apenas atualiza computed_at
    UPDATE public.permission_template_shadow
    SET computed_at = now(), match_type = 'exact', diff = NULL
    WHERE id = existing.id;
  ELSE
    -- Mudou: volta para pendente com novo diff
    UPDATE public.permission_template_shadow
    SET template_id = best_template_id,
        match_type = best_match_type,
        diff = diff_obj,
        review_status = 'pending',
        reviewed_by = NULL,
        reviewed_at = NULL,
        review_notes = NULL,
        computed_at = now()
    WHERE id = existing.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classify_permission_shadow_trg ON public.permissions;
CREATE TRIGGER classify_permission_shadow_trg
AFTER INSERT OR UPDATE OF can_view, can_create, can_edit, can_delete, can_approve
ON public.permissions
FOR EACH ROW
EXECUTE FUNCTION public.classify_permission_shadow();

-- Limpa shadows órfãos quando a permissão é excluída
CREATE OR REPLACE FUNCTION public.cleanup_permission_shadow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.permission_template_shadow WHERE permission_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_permission_shadow_trg ON public.permissions;
CREATE TRIGGER cleanup_permission_shadow_trg
AFTER DELETE ON public.permissions
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_permission_shadow();
