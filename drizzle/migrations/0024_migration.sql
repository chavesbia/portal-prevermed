create or replace function public.tem_html_final(c public.contract_contratos)
returns boolean language sql stable set search_path = public as
$$ select c.html_final is not null and length(c.html_final) > 0 $$;
grant execute on function public.tem_html_final(public.contract_contratos) to authenticated;
create index if not exists idx_contract_contratos_created_at on public.contract_contratos(created_at desc);
create index if not exists idx_contract_contratos_cliente on public.contract_contratos(cliente_id);