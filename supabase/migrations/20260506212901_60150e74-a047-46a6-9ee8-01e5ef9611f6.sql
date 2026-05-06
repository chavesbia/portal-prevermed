
ALTER TABLE public.permission_template_shadow
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

ALTER TABLE public.permission_template_shadow
  DROP CONSTRAINT IF EXISTS permission_template_shadow_review_status_check;
ALTER TABLE public.permission_template_shadow
  ADD CONSTRAINT permission_template_shadow_review_status_check
  CHECK (review_status IN ('pending','approved','rejected'));

CREATE OR REPLACE FUNCTION public.apply_shadow_template(_shadow_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shadow record;
  _tpl record;
BEGIN
  IF NOT public.is_adm_master() THEN
    RAISE EXCEPTION 'Apenas ADM Master pode aprovar mapeamentos.';
  END IF;

  SELECT * INTO _shadow FROM public.permission_template_shadow WHERE id = _shadow_id;
  IF _shadow IS NULL THEN RAISE EXCEPTION 'Mapeamento não encontrado.'; END IF;

  SELECT * INTO _tpl FROM public.role_templates WHERE id = _shadow.template_id;
  IF _tpl IS NULL THEN RAISE EXCEPTION 'Template não encontrado.'; END IF;

  UPDATE public.permissions
  SET can_view = _tpl.can_view,
      can_create = _tpl.can_create,
      can_edit = _tpl.can_edit,
      can_delete = _tpl.can_delete,
      can_approve = _tpl.can_approve,
      updated_at = now()
  WHERE id = _shadow.permission_id;

  UPDATE public.permission_template_shadow
  SET review_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = _notes,
      diff = NULL,
      match_type = 'exact'
  WHERE id = _shadow_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_shadow_template(_shadow_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_adm_master() THEN
    RAISE EXCEPTION 'Apenas ADM Master pode rejeitar mapeamentos.';
  END IF;

  UPDATE public.permission_template_shadow
  SET review_status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = _notes
  WHERE id = _shadow_id;
END;
$$;
