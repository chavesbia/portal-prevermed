CREATE OR REPLACE FUNCTION public.can_view_valores_os()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_adm_master() OR EXISTS (
    SELECT 1 FROM public.user_departments ud
    JOIN public.departments d ON d.id = ud.department_id
    WHERE ud.user_id = auth.uid() AND lower(d.name) IN ('comercial','faturamento')
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_view_valores_os() TO authenticated;

REVOKE SELECT ON public.ppp_solicitacoes FROM authenticated, anon;
GRANT SELECT (id,company_id,solicitante_nome,funcionario_nome,funcionario_cpf,numero,observacao,created_by,created_at,realizado,realizado_por_user_id,realizado_por_nome,realizado_em) ON public.ppp_solicitacoes TO authenticated;

REVOKE SELECT ON public.acrescimos_funcao_solicitacoes FROM authenticated, anon;
GRANT SELECT (id,company_id,unidade_id,solicitante_nome,data_solicitacao_cliente,observacao,created_by,created_at,realizado,realizado_por,realizado_em,numero,realizado_por_user_id,realizado_por_nome) ON public.acrescimos_funcao_solicitacoes TO authenticated;

CREATE OR REPLACE FUNCTION public.get_valores_ppp()
RETURNS TABLE(id uuid, valor numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.valor_calculado::numeric FROM public.ppp_solicitacoes s WHERE public.can_view_valores_os()
$$;
CREATE OR REPLACE FUNCTION public.get_valores_acrescimo()
RETURNS TABLE(id uuid, valor numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.valor_total_calculado::numeric FROM public.acrescimos_funcao_solicitacoes s WHERE public.can_view_valores_os()
$$;
REVOKE EXECUTE ON FUNCTION public.get_valores_ppp() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_valores_acrescimo() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_valores_ppp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_valores_acrescimo() TO authenticated;