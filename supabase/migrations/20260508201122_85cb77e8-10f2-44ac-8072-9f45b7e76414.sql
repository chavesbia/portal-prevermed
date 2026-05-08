-- Generate permission_template_shadow rows for permissions that don't have one yet.
-- Match each permission to the closest template by counting matching flags.
INSERT INTO public.permission_template_shadow (
  permission_id, template_id, match_type, diff, computed_at, review_status
)
SELECT
  p.id AS permission_id,
  best.template_id,
  CASE WHEN best.diff_count = 0 THEN 'exact' ELSE 'closest' END AS match_type,
  CASE WHEN best.diff_count = 0 THEN NULL ELSE best.diff END AS diff,
  now() AS computed_at,
  'pending' AS review_status
FROM public.permissions p
CROSS JOIN LATERAL (
  SELECT
    rt.id AS template_id,
    (
      (CASE WHEN rt.can_view    IS DISTINCT FROM p.can_view    THEN 1 ELSE 0 END) +
      (CASE WHEN rt.can_create  IS DISTINCT FROM p.can_create  THEN 1 ELSE 0 END) +
      (CASE WHEN rt.can_edit    IS DISTINCT FROM p.can_edit    THEN 1 ELSE 0 END) +
      (CASE WHEN rt.can_delete  IS DISTINCT FROM p.can_delete  THEN 1 ELSE 0 END) +
      (CASE WHEN rt.can_approve IS DISTINCT FROM p.can_approve THEN 1 ELSE 0 END)
    ) AS diff_count,
    (
      jsonb_strip_nulls(jsonb_build_object(
        'can_view',    CASE WHEN rt.can_view    IS DISTINCT FROM p.can_view    THEN jsonb_build_object('current', p.can_view,    'template', rt.can_view)    END,
        'can_create',  CASE WHEN rt.can_create  IS DISTINCT FROM p.can_create  THEN jsonb_build_object('current', p.can_create,  'template', rt.can_create)  END,
        'can_edit',    CASE WHEN rt.can_edit    IS DISTINCT FROM p.can_edit    THEN jsonb_build_object('current', p.can_edit,    'template', rt.can_edit)    END,
        'can_delete',  CASE WHEN rt.can_delete  IS DISTINCT FROM p.can_delete  THEN jsonb_build_object('current', p.can_delete,  'template', rt.can_delete)  END,
        'can_approve', CASE WHEN rt.can_approve IS DISTINCT FROM p.can_approve THEN jsonb_build_object('current', p.can_approve, 'template', rt.can_approve) END
      ))
    ) AS diff
  FROM public.role_templates rt
  ORDER BY (
    (CASE WHEN rt.can_view    IS DISTINCT FROM p.can_view    THEN 1 ELSE 0 END) +
    (CASE WHEN rt.can_create  IS DISTINCT FROM p.can_create  THEN 1 ELSE 0 END) +
    (CASE WHEN rt.can_edit    IS DISTINCT FROM p.can_edit    THEN 1 ELSE 0 END) +
    (CASE WHEN rt.can_delete  IS DISTINCT FROM p.can_delete  THEN 1 ELSE 0 END) +
    (CASE WHEN rt.can_approve IS DISTINCT FROM p.can_approve THEN 1 ELSE 0 END)
  ) ASC
  LIMIT 1
) best
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_template_shadow s WHERE s.permission_id = p.id
);