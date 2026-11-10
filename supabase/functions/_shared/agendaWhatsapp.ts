// Aviso ativo por WhatsApp (n8n -> Evolution) para protocolos que nasceram no WhatsApp.
// O número vem de whatsapp_registros (só servidor); falhas nunca bloqueiam a aprovação.
const WEBHOOK = Deno.env.get('N8N_NOTIFICACOES_URL') ?? 'https://prevermed-n8n.vlyrta.easypanel.host/webhook/notificacoes-agendamento';

const fmtData = (d?: string | null) => (d ? d.split('-').reverse().join('/') : '');

export async function whatsappAgenda(admin: any, agendamentoId: string, modelo: 'confirmado' | 'devolvido' | 'estrutura') {
  try {
    const { data: ag } = await admin.from('soc_agendamentos')
      .select('protocolo, colaborador_nome, data_agendada, hora_agendada, devolucao_motivo, soc_agenda_unidades(nome)')
      .eq('id', agendamentoId).maybeSingle();
    if (!ag?.protocolo) return;
    const { data: reg } = await admin.from('whatsapp_registros').select('telefone').eq('protocolo', ag.protocolo).not('telefone', 'is', null).limit(1).maybeSingle();
    if (!reg?.telefone) return;
    const p = `*Protocolo ${ag.protocolo}*`;
    const unidade = (ag.soc_agenda_unidades as any)?.nome ?? '';
    const mensagem = modelo === 'confirmado'
      ? `PreverMed: pré-agendamento confirmado, ${p}.\nColaborador: ${ag.colaborador_nome ?? '-'}\nData: ${fmtData(ag.data_agendada)} às ${String(ag.hora_agendada ?? '').slice(0, 5)}\nUnidade: ${unidade}\nO horário é uma previsão; o atendimento segue a ordem de acolhimento.`
      : modelo === 'devolvido'
        ? `PreverMed: a solicitação ${p} foi devolvida pela equipe.\nMotivo: ${ag.devolucao_motivo ?? '-'}\nPara seguir, faça uma nova solicitação com os ajustes.`
        : `PreverMed: a estrutura (unidade/setor/cargo) do ${p} já foi cadastrada.\nAgora você já pode realizar o agendamento pelo link ou por aqui.`;
    const r = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numero: reg.telefone, protocolo: ag.protocolo, modelo, mensagem }) });
    await admin.from('audit_log').insert({ user_id: null, action_type: r.ok ? 'agenda_whatsapp_enviado' : 'agenda_whatsapp_falha', object_type: 'soc_agendamento', object_id: agendamentoId, details: { protocolo: ag.protocolo, modelo, status: r.status } }).then(() => null, () => null);
  } catch (e) { console.error('whatsappAgenda', e); }
}
