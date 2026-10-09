// Aprovação da documentação de Retorno ao Trabalho pela equipe de saúde; aprovado = grava no SOC
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { incluirAgendamentoSoc } from '../_shared/socAgendamento.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  agendamentoId: z.string().uuid(),
  decisao: z.enum(['aprovar', 'devolver']),
  motivo: z.string().trim().max(1000).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.replace(/^Bearer /, ''));
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: 'Não autenticado' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const [{ data: pode }, { data: master }] = await Promise.all([
      admin.rpc('can_approve_module_route', { _user_id: uid, _route: '/agendamentos' }),
      admin.rpc('has_role', { _user_id: uid, _role: 'adm_master' }),
    ]);
    if (!pode && !master) {
      await admin.rpc('log_unauthorized_access', { _resource: 'agenda-aprovacao', _source: 'edge', _method: 'POST', _details: {} }).catch(() => null);
      return json({ error: 'Sem permissão para aprovar documentação' }, 403);
    }

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Dados inválidos' }, 400);
    const b = parsed.data;
    if (b.decisao === 'devolver' && (!b.motivo || b.motivo.length < 5)) return json({ error: 'Informe o motivo da devolução.' }, 400);

    const { data: ag } = await admin.from('soc_agendamentos')
      .select('id, protocolo, codigo_empresa_soc, colaborador_cpf, tipo_exame, data_agendada, hora_agendada, exames, observacoes, motivo_retorno, aprovacao_status, soc_agenda_unidades(codigo_agenda)')
      .eq('id', b.agendamentoId).maybeSingle();
    if (!ag) return json({ error: 'Agendamento não encontrado' }, 404);
    if (ag.aprovacao_status !== 'pendente') return json({ error: 'Este agendamento não está aguardando aprovação.' }, 400);

    const audit = (acao: string, details: Record<string, unknown>) =>
      admin.from('audit_log').insert({ user_id: uid, action_type: acao, object_type: 'soc_agendamento', object_id: ag.id, details });

    if (b.decisao === 'devolver') {
      await admin.from('soc_agendamentos').update({ aprovacao_status: 'devolvido', status: 'documentacao_devolvida', devolucao_motivo: b.motivo, aprovado_por: uid, aprovado_em: new Date().toISOString() }).eq('id', ag.id);
      await audit('agenda_documentacao_devolvida', { protocolo: ag.protocolo, motivo: b.motivo });
      return json({ ok: true });
    }

    const soc = await incluirAgendamentoSoc({
      codigoEmpresa: ag.codigo_empresa_soc, cpf: ag.colaborador_cpf,
      codigoAgenda: (ag.soc_agenda_unidades as any)?.codigo_agenda, data: ag.data_agendada, hora: String(ag.hora_agendada).slice(0, 5),
      tipoExame: ag.tipo_exame,
      detalhes: [`Portal: ${ag.protocolo}`, `Exames: ${(ag.exames as string[]).join(', ') || '-'}`, `Motivo do retorno: ${ag.motivo_retorno ?? '-'}`, 'Documentação aprovada no Portal', ag.observacoes ? `Obs: ${ag.observacoes}` : ''].filter(Boolean).join('\n'),
    });
    await admin.from('soc_agendamentos').update({
      aprovacao_status: 'aprovado', aprovado_por: uid, aprovado_em: new Date().toISOString(), devolucao_motivo: null,
      status: soc.ok ? 'agendado_soc' : 'solicitado',
      soc_retorno: { codigoAgendamento: soc.codigoAgendamento ?? null, resposta: soc.resposta }, soc_erro: soc.ok ? null : soc.erro,
    }).eq('id', ag.id);
    await audit('agenda_documentacao_aprovada', { protocolo: ag.protocolo, agendadoSoc: soc.ok, erro: soc.ok ? null : soc.erro });
    return json({ ok: true, agendadoSoc: soc.ok, erro: soc.ok ? null : `Aprovado, mas o SOC recusou o horário: ${soc.erro}. Combine outro horário com o cliente.` });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
