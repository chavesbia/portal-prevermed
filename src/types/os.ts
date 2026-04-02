// Types matching the database schema for Ordens de Serviço

export type StatusOS =
  | 'Não iniciado'
  | 'Em andamento'
  | 'Em revisão interna'
  | 'Aguardando assinatura'
  | 'Aguardando cliente'
  | 'Encerrado';

export type StatusServico =
  | 'Não iniciado'
  | 'Em andamento'
  | 'Concluído'
  | 'Pendente';

export type TipoOS = 'Novo' | 'Revisão';

export interface ServicoOS {
  id: string;
  ordem_id: string;
  tipo: string;
  tipo_os: TipoOS;
  status: StatusServico;
  data_inicio: string | null;
  data_conclusao: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrdemServico {
  id: string;
  numero_os: string;
  empresa_cliente: string;
  contato_cliente: string | null;
  responsavel_atual: string;
  status_os: StatusOS;
  data_registro: string;
  data_emissao: string | null;
  prazo_acordado: string | null;
  observacoes: string | null;
  tipo_servico_resumo: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  servicos?: ServicoOS[];
}

export interface HistoricoOS {
  id: string;
  ordem_id: string;
  user_id: string | null;
  user_name: string | null;
  acao: string;
  comentario: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  servico_afetado: string | null;
  created_at: string;
}

export interface OSFilters {
  search: string;
  status_os: string;
  responsavel: string;
  tipo_servico: string;
  tipo_os: string;
  periodo_inicio: Date | null;
  periodo_fim: Date | null;
}

export const STATUS_OS_OPTIONS: StatusOS[] = [
  'Não iniciado',
  'Em andamento',
  'Em revisão interna',
  'Aguardando assinatura',
  'Aguardando cliente',
  'Encerrado',
];

export const STATUS_SERVICO_OPTIONS: StatusServico[] = [
  'Não iniciado',
  'Em andamento',
  'Concluído',
  'Pendente',
];

export const TIPO_OS_OPTIONS: TipoOS[] = ['Novo', 'Revisão'];

export const TIPO_SERVICO_OPTIONS = [
  'PCMSO', 'PGR', 'LTCAT', 'DRPS', 'AET', 'APR',
  'INSALUBRIDADE', 'PERICULOSIDADE', 'CIPA', 'TREINAMENTO',
  'PPP', 'PERICIA TÉCNICA', 'PERICIA MÉDICA',
];

export const statusOSColors: Record<string, string> = {
  'Não iniciado': 'bg-muted text-muted-foreground',
  'Em andamento': 'bg-primary text-primary-foreground',
  'Em revisão interna': 'bg-yellow-500 text-white',
  'Aguardando assinatura': 'bg-purple-500 text-white',
  'Aguardando cliente': 'bg-blue-400 text-white',
  'Encerrado': 'bg-emerald-600 text-white',
};

export const statusServicoColors: Record<string, string> = {
  'Não iniciado': 'bg-muted text-muted-foreground',
  'Em andamento': 'bg-blue-500 text-white',
  'Concluído': 'bg-emerald-600 text-white',
  'Pendente': 'bg-yellow-500 text-white',
};
