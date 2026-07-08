export type OSCustoTipo =
  | 'profissional_externo'
  | 'art'
  | 'deslocamento'
  | 'locacao_equipamento'
  | 'hospedagem'
  | 'alimentacao'
  | 'outros';

export const OS_CUSTO_TIPO_OPTIONS: { value: OSCustoTipo; label: string }[] = [
  { value: 'profissional_externo', label: 'Profissional externo' },
  { value: 'art', label: 'ART' },
  { value: 'deslocamento', label: 'Deslocamento' },
  { value: 'locacao_equipamento', label: 'Locação de equipamento' },
  { value: 'hospedagem', label: 'Hospedagem' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'outros', label: 'Outros' },
];

export const OS_CUSTO_TIPO_LABEL: Record<OSCustoTipo, string> = OS_CUSTO_TIPO_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<OSCustoTipo, string>,
);

export interface OSCusto {
  id: string;
  ordem_id: string;
  servico_os_id: string | null;
  profissional_id: string | null;
  tipo: OSCustoTipo;
  descricao: string;
  valor: number;
  data: string;
  fornecedor: string | null;
  anexo_url: string | null;
  observacoes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OSCustoInput {
  ordem_id: string;
  servico_os_id?: string | null;
  profissional_id?: string | null;
  tipo: OSCustoTipo;
  descricao: string;
  valor: number;
  data: string;
  fornecedor?: string | null;
  observacoes?: string | null;
}
