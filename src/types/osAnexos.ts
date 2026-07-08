export type OSAnexoCategoria = 'art' | 'comprovante' | 'relatorio' | 'checklist' | 'laudo' | 'outro';

export const OS_ANEXO_CATEGORIA_OPTIONS: OSAnexoCategoria[] = [
  'art', 'comprovante', 'relatorio', 'checklist', 'laudo', 'outro',
];

export const osAnexoCategoriaLabel: Record<OSAnexoCategoria, string> = {
  art: 'ART',
  comprovante: 'Comprovante',
  relatorio: 'Relatório',
  checklist: 'CheckList',
  laudo: 'Laudo',
  outro: 'Outro',
};

export const osAnexoCategoriaColors: Record<OSAnexoCategoria, string> = {
  art: 'bg-purple-100 text-purple-700 border-purple-300',
  comprovante: 'bg-blue-100 text-blue-700 border-blue-300',
  relatorio: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  checklist: 'bg-amber-100 text-amber-700 border-amber-300',
  laudo: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  outro: 'bg-muted text-muted-foreground border-border',
};

export interface OSAnexo {
  id: string;
  ordem_id: string;
  servico_os_id: string | null;
  categoria: OSAnexoCategoria;
  nome: string;
  descricao: string | null;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  data_vencimento: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
