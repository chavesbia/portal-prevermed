
CREATE TABLE IF NOT EXISTS public.permission_template_shadow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id UUID NOT NULL UNIQUE REFERENCES public.permissions(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.role_templates(id) ON DELETE RESTRICT,
  match_type TEXT NOT NULL CHECK (match_type IN ('exact','closest')),
  diff JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_template_shadow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only adm_master can view shadow mapping"
ON public.permission_template_shadow FOR SELECT
TO authenticated USING (public.is_adm_master());

CREATE POLICY "Only adm_master can manage shadow mapping"
ON public.permission_template_shadow FOR ALL
TO authenticated USING (public.is_adm_master()) WITH CHECK (public.is_adm_master());

-- Popula o mapeamento shadow
WITH scored AS (
  SELECT
    p.id AS permission_id,
    rt.id AS template_id,
    rt.slug,
    -- score: número de flags coincidentes
    (
      (CASE WHEN rt.can_view = p.can_view THEN 1 ELSE 0 END) +
      (CASE WHEN rt.can_create = p.can_create THEN 1 ELSE 0 END) +
      (CASE WHEN rt.can_edit = p.can_edit THEN 1 ELSE 0 END) +
      (CASE WHEN rt.can_delete = p.can_delete THEN 1 ELSE 0 END) +
      (CASE WHEN rt.can_approve = p.can_approve THEN 1 ELSE 0 END)
    ) AS score,
    jsonb_build_object(
      'can_view',    jsonb_build_object('perm', p.can_view,    'tpl', rt.can_view),
      'can_create',  jsonb_build_object('perm', p.can_create,  'tpl', rt.can_create),
      'can_edit',    jsonb_build_object('perm', p.can_edit,    'tpl', rt.can_edit),
      'can_delete',  jsonb_build_object('perm', p.can_delete,  'tpl', rt.can_delete),
      'can_approve', jsonb_build_object('perm', p.can_approve, 'tpl', rt.can_approve)
    ) AS diff
  FROM public.permissions p
  CROSS JOIN public.role_templates rt
  WHERE COALESCE(p.can_view,false) = true
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY permission_id ORDER BY score DESC, slug) AS rn
  FROM scored
)
INSERT INTO public.permission_template_shadow (permission_id, template_id, match_type, diff)
SELECT permission_id, template_id,
  CASE WHEN score = 5 THEN 'exact' ELSE 'closest' END,
  CASE WHEN score = 5 THEN NULL ELSE diff END
FROM ranked
WHERE rn = 1
ON CONFLICT (permission_id) DO UPDATE
SET template_id = EXCLUDED.template_id,
    match_type = EXCLUDED.match_type,
    diff = EXCLUDED.diff,
    computed_at = now();
