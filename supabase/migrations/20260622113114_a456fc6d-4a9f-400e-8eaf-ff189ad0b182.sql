WITH new_mod AS (
  INSERT INTO public.modules (name, description, icon, route, is_active, sort_order)
  VALUES ('Gestão de Feedback', 'Avaliação de desempenho, PDI e indicadores de pessoas', 'Users', '/gestao-feedback', true, 60)
  ON CONFLICT (name) DO UPDATE SET route = EXCLUDED.route, icon = EXCLUDED.icon, description = EXCLUDED.description, is_active = true
  RETURNING id
),
rh_dept AS (
  SELECT id FROM public.departments
  WHERE lower(name) IN ('rh','recursos humanos') OR lower(name) LIKE '%recursos humanos%' OR lower(name) LIKE 'rh%'
  ORDER BY name LIMIT 1
)
INSERT INTO public.department_modules (department_id, module_id)
SELECT (SELECT id FROM rh_dept), (SELECT id FROM new_mod)
WHERE (SELECT id FROM rh_dept) IS NOT NULL
ON CONFLICT DO NOTHING;