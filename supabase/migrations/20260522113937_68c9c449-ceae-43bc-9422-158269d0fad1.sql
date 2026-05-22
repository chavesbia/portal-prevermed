REVOKE EXECUTE ON FUNCTION public.dashboard_guias_agregado(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_guias_agregado(date, date) TO authenticated;