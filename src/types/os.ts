// Types matching the database schema for Ordens de Serviço

// Fase 2: Status macro da OS — dispara SLA
export type StatusOS =
  | 'Não iniciado'
  | 'Em andamento'
  | 'Encerrado';

// Fase 2: Status operacional do Serviço
export type StatusServico =
  | 'Não iniciado'
  | 'Em andamento'
  | 'Agendado'
  | 'Em revisão interna'
  | 'Aguardando cliente'
  | 'Encerrado';

export type TipoOS = 'Novo' | 'Revisão';

export type ConselhoProfissional = 'CREA' | 'CRF' | 'CRM' | 'CRQ' | 'OUTRO';

export type StatusVigencia = 'Vigente' | 'A vencer' | 'Vencido' | 'Sem vigência';

export interface ServicoOS {
  id: string;
  ordem_id: string;
  tipo: string;
  tipo_os: TipoOS;
  status: StatusServico;
  data_inicio: string | null;
  data_conclusao: string | null;
  observacoes: string | null;
  responsavel_id: string | null;
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
  contrato_id: string | null;
  quotation_id: string | null;
  receita_prevista: number | null;
  orcamento_custo: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  servicos?: ServicoOS[];
}

export interface OSFinanceiroRow {
  ordem_id: string;
  numero_os: string;
  empresa_cliente: string;
  status_os: StatusOS;
  data_registro: string;
  data_emissao: string | null;
  prazo_acordado: string | null;
  responsavel_atual: string;
  contrato_id: string | null;
  quotation_id: string | null;
  receita_prevista: number | null;
  orcamento_custo: number | null;
  custo_total: number;
  margem_valor: number;
  margem_percent: number | null;
  custo_estourado: boolean;
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

export interface ResponsavelTecnico {
  id: string;
  nome: string;
  conselho: ConselhoProfissional;
  numero_registro: string;
  especialidade: string;
  email: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipoLaudo {
  id: string;
  nome: string;
  descricao: string;
  exige_vigencia: boolean;
  conselhos_permitidos: string[];
  prazo_vigencia_padrao: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Laudo {
  id: string;
  ordem_id: string;
  servico_id: string;
  tipo_laudo_id: string;
  responsavel_tecnico_id: string;
  numero_os: string;
  empresa_cliente: string;
  tipo_servico: string;
  tipo_laudo_nome: string;
  responsavel_tecnico_nome: string;
  responsavel_tecnico_registro: string;
  data_emissao: string;
  possui_vigencia: boolean;
  data_validade: string | null;
  justificativa_sem_vigencia: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracaoAlerta {
  id: string;
  tipo_laudo_id: string | null;
  dias_antecedencia: number[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
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
  'Encerrado',
];

export const STATUS_SERVICO_OPTIONS: StatusServico[] = [
  'Não iniciado',
  'Em andamento',
  'Agendado',
  'Em revisão interna',
  'Aguardando cliente',
  'Encerrado',
];

export const TIPO_OS_OPTIONS: TipoOS[] = ['Novo', 'Revisão'];

export const TIPO_SERVICO_OPTIONS = [
  'PCMSO', 'PGR', 'LTCAT', 'DRPS', 'AET', 'APR',
  'INSALUBRIDADE', 'PERICULOSIDADE', 'CIPA', 'TREINAMENTO',
  'PPP', 'PERICIA TÉCNICA', 'PERICIA MÉDICA',
];

export const CONSELHO_OPTIONS: ConselhoProfissional[] = ['CREA', 'CRF', 'CRM', 'CRQ', 'OUTRO'];

export const statusOSColors: Record<string, string> = {
  'Não iniciado': 'bg-muted text-muted-foreground',
  'Em andamento': 'bg-primary text-primary-foreground',
  'Encerrado': 'bg-emerald-600 text-white',
};

export const statusServicoColors: Record<string, string> = {
  'Não iniciado': 'bg-muted text-muted-foreground',
  'Em andamento': 'bg-blue-500 text-white',
  'Agendado': 'bg-indigo-500 text-white',
  'Em revisão interna': 'bg-yellow-500 text-white',
  'Aguardando cliente': 'bg-blue-400 text-white',
  'Encerrado': 'bg-emerald-600 text-white',
};

// Fase 2 — SLA por OS
export type SLAStatus = 'em_dia' | 'atencao' | 'atrasado' | 'encerrado' | 'sem_prazo';

export const slaStatusColors: Record<SLAStatus, string> = {
  em_dia: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  atencao: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  atrasado: 'bg-red-100 text-red-700 border-red-300',
  encerrado: 'bg-muted text-muted-foreground border-border',
  sem_prazo: 'bg-muted text-muted-foreground border-border',
};

export const slaStatusLabels: Record<SLAStatus, string> = {
  em_dia: 'Em dia',
  atencao: 'Atenção',
  atrasado: 'Atrasado',
  encerrado: 'Encerrado',
  sem_prazo: 'Sem prazo',
};

