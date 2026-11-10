// E-mails da Agenda: destinatário vem sempre do registro gravado (solicitante), nunca do navegador.
// Falha de e-mail nunca derruba o agendamento — só registra no log.
import { sendTemplateEmail } from './transactional-email-templates/send-email.ts'
import { preparosDosExames } from './preparosExames.ts'

export async function emailAgenda(admin: any, agendamentoId: string, modelo: 'agenda-protocolo-aberto' | 'agenda-confirmado' | 'agenda-estrutura-engenharia' | 'agenda-devolvido', extra: Record<string, unknown> = {}) {
  try {
    const { data: ag } = await admin.from('soc_agendamentos')
      .select('protocolo, solicitante, colaborador_nome, empresa_nome, tipo_exame, data_agendada, hora_agendada, exames, estrutura_solicitada, devolucao_motivo, soc_agenda_unidades(nome)')
      .eq('id', agendamentoId).maybeSingle()
    const email = ag?.solicitante?.email
    if (!email) return
    const exames: string[] = ag.exames ?? []
    const est = ag.estrutura_solicitada ?? {}
    await sendTemplateEmail(modelo, email, {
      idempotencyKey: `${modelo}-${agendamentoId}${extra.concluido ? '-ok' : ''}`,
      templateData: {
        protocolo: ag.protocolo, nome: String(ag.solicitante?.nome ?? '').split(' ')[0],
        colaborador: ag.colaborador_nome, empresa: ag.empresa_nome, tipoExame: ag.tipo_exame,
        data: ag.data_agendada, hora: ag.hora_agendada ? String(ag.hora_agendada).slice(0, 5) : undefined,
        unidade: ag.soc_agenda_unidades?.nome ?? est.unidade, setor: est.setor, cargo: est.cargo,
        exames, preparos: preparosDosExames(exames).map((p) => ({ nome: p.nome, texto: p.texto })),
        motivo: ag.devolucao_motivo ?? undefined, ...extra,
      },
    })
  } catch (e) {
    console.error('[agenda-email]', modelo, agendamentoId, String(e))
  }
}
