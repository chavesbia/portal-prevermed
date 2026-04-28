export type VisitaStatus = 'agendada' | 'realizada' | 'cancelada';
export type VisitaTipo = 'Avaliação' | 'Coleta' | 'Inspeção' | 'Reunião' | 'Treinamento' | 'Outro';

export interface OSVisita {
  id: string;
  empresa_cliente: string;
  ordem_id: string | null;
  numero_os: string | null;
  data_visita: string;
  hora_visita: string | null;
  responsavel_id: string | null;
  responsavel_nome: string;
  tipo_visita: VisitaTipo;
  status: VisitaStatus;
  endereco: string | null;
  observacoes: string | null;
  motivo_cancelamento: string | null;
  custos_deslocamento: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// Equipamento de Medição (modelo do projeto original)
export interface OSEquipamento {
  id: string;
  nome: string;
  tipo: string | null;
  fabricante: string | null;
  data_ultima_calibracao: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OSEquipamentoHistorico {
  id: string;
  equipamento_id: string;
  user_id: string | null;
  user_name: string | null;
  acao: string;
  comentario: string | null;
  ordem_id: string | null;
  created_at: string;
}

export interface OSVisitaEquipamento {
  id: string;
  visita_id: string;
  equipamento_id: string;
  created_at: string;
}

export type CalibracaoStatus = 'sem_dados' | 'valida' | 'a_vencer' | 'vencida';

export function getCalibracaoStatus(data: string | null): { status: CalibracaoStatus; label: string; days: number | null } {
  if (!data) return { status: 'sem_dados', label: 'Não informada', days: null };
  const d = new Date(data + 'T00:00:00');
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days > 365) return { status: 'vencida', label: 'Vencida', days };
  if (days > 300) return { status: 'a_vencer', label: 'Próxima ao vencimento', days };
  return { status: 'valida', label: 'Válida', days };
}

export const calibracaoStatusColors: Record<CalibracaoStatus, string> = {
  sem_dados: 'bg-muted text-muted-foreground',
  valida: 'bg-emerald-600 text-white',
  a_vencer: 'bg-yellow-500 text-white',
  vencida: 'bg-destructive text-destructive-foreground',
};

export const VISITA_TIPO_OPTIONS: VisitaTipo[] = [
  'Avaliação', 'Coleta', 'Inspeção', 'Reunião', 'Treinamento', 'Outro',
];

export const VISITA_STATUS_OPTIONS: VisitaStatus[] = ['agendada', 'realizada', 'cancelada'];

export const visitaStatusLabel: Record<VisitaStatus, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export const visitaStatusColors: Record<VisitaStatus, string> = {
  agendada: 'bg-primary text-primary-foreground',
  realizada: 'bg-emerald-600 text-white',
  cancelada: 'bg-destructive text-destructive-foreground',
};
