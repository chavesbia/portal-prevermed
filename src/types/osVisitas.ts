export type VisitaStatus = 'agendada' | 'realizada' | 'cancelada';
export type VisitaTipo = 'Avaliação' | 'Coleta' | 'Inspeção' | 'Reunião' | 'Treinamento' | 'Outro';
export type EquipamentoStatus = 'ativo' | 'em_manutencao' | 'inativo' | 'descartado';

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
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OSEquipamento {
  id: string;
  nome: string;
  tipo: string | null;
  empresa_cliente: string;
  localizacao: string | null;
  status: EquipamentoStatus;
  observacoes: string | null;
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

export const VISITA_TIPO_OPTIONS: VisitaTipo[] = [
  'Avaliação', 'Coleta', 'Inspeção', 'Reunião', 'Treinamento', 'Outro',
];

export const VISITA_STATUS_OPTIONS: VisitaStatus[] = ['agendada', 'realizada', 'cancelada'];

export const EQUIPAMENTO_STATUS_OPTIONS: EquipamentoStatus[] = [
  'ativo', 'em_manutencao', 'inativo', 'descartado',
];

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

export const equipamentoStatusLabel: Record<EquipamentoStatus, string> = {
  ativo: 'Ativo',
  em_manutencao: 'Em manutenção',
  inativo: 'Inativo',
  descartado: 'Descartado',
};

export const equipamentoStatusColors: Record<EquipamentoStatus, string> = {
  ativo: 'bg-emerald-600 text-white',
  em_manutencao: 'bg-yellow-500 text-white',
  inativo: 'bg-muted text-muted-foreground',
  descartado: 'bg-destructive text-destructive-foreground',
};
