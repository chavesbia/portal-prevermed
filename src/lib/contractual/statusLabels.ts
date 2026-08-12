export const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  rascunho: { label: 'Pronto para Envio', tone: 'bg-blue-100 text-blue-700' },
  aguardando_assinatura: { label: 'Aguardando assinatura', tone: 'bg-amber-100 text-amber-800' },
  parcialmente_assinado: { label: 'Parc. assinado', tone: 'bg-orange-100 text-orange-800' },
  assinado: { label: 'Assinado', tone: 'bg-emerald-50 text-emerald-600' },
  ativo: { label: 'Ativo', tone: 'bg-emerald-100 text-emerald-800' },
  vencendo_60: { label: 'Vence 60d', tone: 'bg-amber-200 text-amber-900' },
  vencendo_30: { label: 'Vence 30d', tone: 'bg-amber-200 text-amber-900' },
  vencendo_15: { label: 'Vence 15d', tone: 'bg-amber-200 text-amber-900' },
  vencido: { label: 'Vencido', tone: 'bg-red-100 text-red-800' },
  encerrado: { label: 'Encerrado', tone: 'bg-slate-600 text-white' },
  cancelado: { label: 'Cancelado', tone: 'bg-red-50 text-red-600' },
};

/**
 * Lógica compartilhada para distinguir entre rascunho em preenchimento e pronto para envio.
 */
export const getContractStatusDisplay = (contrato: { status: string; html_final?: string | null }) => {
  const isRascunhoAberto = contrato.status === 'rascunho' && !contrato.html_final;
  
  if (isRascunhoAberto) {
    return { label: 'Em preenchimento', tone: 'bg-slate-100 text-slate-700' };
  }
  
  return STATUS_LABEL[contrato.status] || { label: contrato.status, tone: 'bg-slate-100' };
};
