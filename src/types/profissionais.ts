export type ProfissionalTipo = 'interno' | 'externo';

export type ProfissionalCategoria =
  | 'Médico(a)'
  | 'Engenheiro(a) de Segurança do Trabalho'
  | 'Técnico(a) de Segurança do Trabalho'
  | 'Auxiliar Técnico'
  | 'Outro';

export const PROFISSIONAL_CATEGORIAS: ProfissionalCategoria[] = [
  'Médico(a)',
  'Engenheiro(a) de Segurança do Trabalho',
  'Técnico(a) de Segurança do Trabalho',
  'Auxiliar Técnico',
  'Outro',
];

export interface Profissional {
  id: string;
  nome: string;
  tipo: ProfissionalTipo;
  categoria: ProfissionalCategoria;
  conselho_id: string | null;
  numero_conselho: string | null;
  email: string | null;
  telefone: string | null;
  custo_padrao: number | null;
  user_id: string | null;
  ativo: boolean;
  observacoes: string | null;
  pode_ser_responsavel_tecnico?: boolean;
  pode_ser_executor?: boolean;
  especialidade?: string | null;
  cpf?: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined (optional)
  conselho_sigla?: string | null;
}

export const tipoProfissionalLabel: Record<ProfissionalTipo, string> = {
  interno: 'Interno',
  externo: 'Externo',
};
