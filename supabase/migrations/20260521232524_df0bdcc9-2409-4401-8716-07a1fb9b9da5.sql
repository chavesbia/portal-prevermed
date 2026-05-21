REVOKE EXECUTE ON FUNCTION public.listar_guias(jsonb, text, text, int, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guias_filtros_disponiveis() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guias_business_days(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guias_sla_status(date, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guias_status_guia(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guias_business_days(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guias_sla_status(date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guias_status_guia(text, text, text, text) TO authenticated;