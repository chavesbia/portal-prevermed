export type ProfissionalTipo = 'interno' | 'externo';

export type ProfissionalCategoria =
  | 'Médico'
  | 'Psicólogo'
  | 'Enfermeiro'
  | 'Engenheiro de Segurança'
  | 'Técnico de Segurança'
  | 'Fonoaudiólogo'
  | 'Fisioterapeuta'
  | 'Outro';

export const PROFISSIONAL_CATEGORIAS: ProfissionalCategoria[] = [
  'Médico',
  'Psicólogo',
  'Enfermeiro',
  'Engenheiro de Segurança',
  'Técnico de Segurança',
  'Fonoaudiólogo',
  'Fisioterapeuta',
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
