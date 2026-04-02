import { addDays, isBefore, isAfter } from 'date-fns';

export type ClientStatus =
  | 'sem_contrato'
  | 'contrato_nao_assinado'
  | 'vencido'
  | 'a_vencer'
  | 'renovacao_pendente'
  | 'documentacao_incompleta'
  | 'ok';

export interface ClientStatusInput {
  has_contract: boolean;
  contract_signed: boolean;
  contract_end_date: string | null;
  proposal_approved: boolean;
  pricing_table_attached: boolean;
  attachments_count?: number;
}

export function computeClientStatus(client: ClientStatusInput): ClientStatus {
  const today = new Date();

  if (!client.has_contract) return 'sem_contrato';
  if (client.has_contract && !client.contract_signed) {
    if (client.proposal_approved) return 'renovacao_pendente';
    return 'contrato_nao_assinado';
  }

  if (client.contract_end_date) {
    const endDate = new Date(client.contract_end_date);
    if (isBefore(endDate, today)) return 'vencido';
    if (isBefore(endDate, addDays(today, 60))) return 'a_vencer';
  }

  const hasContract = (client.attachments_count ?? 0) > 0;
  if (!hasContract || !client.pricing_table_attached) return 'documentacao_incompleta';

  return 'ok';
}

export const statusLabels: Record<ClientStatus, string> = {
  sem_contrato: 'Sem Contrato',
  contrato_nao_assinado: 'Contrato Não Assinado',
  vencido: 'Vencido',
  a_vencer: 'A Vencer',
  renovacao_pendente: 'Renovação Pendente',
  documentacao_incompleta: 'Documentação Incompleta',
  ok: 'Documentação em Dia',
};

export const statusColors: Record<ClientStatus, string> = {
  sem_contrato: 'bg-destructive text-destructive-foreground',
  contrato_nao_assinado: 'bg-orange-500 text-white',
  vencido: 'bg-destructive text-destructive-foreground',
  a_vencer: 'bg-yellow-500 text-white',
  renovacao_pendente: 'bg-blue-500 text-white',
  documentacao_incompleta: 'bg-amber-600 text-white',
  ok: 'bg-emerald-600 text-white',
};
