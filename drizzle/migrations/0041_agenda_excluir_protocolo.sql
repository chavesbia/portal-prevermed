CREATE OR REPLACE FUNCTION public.agenda_excluir_protocolo(_agendamento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  if not public.is_adm_master() then
    perform public.log_unauthorized_access('soc_agendamentos','agenda_excluir_protocolo','DELETE',jsonb_build_object('id',_agendamento_id));
    raise exception 'Apenas ADM Master pode excluir protocolos';
  end if;
  select id, protocolo, empresa_nome, colaborador_nome, fila_aprovacao, aprovacao_status, created_at into r from soc_agendamentos where id=_agendamento_id;
  if not found then raise exception 'Protocolo não encontrado'; end if;
  delete from soc_agendamento_anexos where agendamento_id=_agendamento_id;
  delete from soc_agendamentos where id=_agendamento_id;
  insert into audit_log(user_id, action_type, object_type, object_id, details, comment)
  values (auth.uid(), 'delete', 'soc_agendamento', _agendamento_id, to_jsonb(r), 'Exclusão de protocolo por ADM Master');
end $function$;

REVOKE ALL ON FUNCTION public.agenda_excluir_protocolo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_excluir_protocolo(uuid) TO authenticated;