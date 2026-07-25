INSERT INTO public.modules (name, route, icon, description, is_active, requires_permission, app_type, sort_order)
VALUES ('Painel do Cliente', '/painel-cliente', 'Building2', 'Consulta gerencial consolidada por empresa cliente', true, true, 'internal', 50)
ON CONFLICT DO NOTHING;