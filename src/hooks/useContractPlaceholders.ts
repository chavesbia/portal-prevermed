import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContractPlaceholder {
  id: string;
  chave: string;
  label: string;
  descricao: string | null;
  grupo: string;
  ordem: number;
  ativo: boolean;
  fonte: string | null;
  formato: string;
}

export const PLACEHOLDER_GRUPOS: { key: string; label: string }[] = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'contrato', label: 'Contrato' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'assinatura', label: 'Assinatura' },
  { key: 'treinamentos', label: 'Treinamentos' },
  { key: 'outros', label: 'Outros' },
];

export const PLACEHOLDER_FORMATOS: { key: string; label: string; help?: string }[] = [
  { key: 'texto', label: 'Texto' },
  { key: 'numero', label: 'Número' },
  { key: 'moeda', label: 'Moeda (R$)' },
  { key: 'percentual', label: 'Percentual (%)' },
  { key: 'data', label: 'Data (DD/MM/AAAA)' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'cpf', label: 'CPF' },
  { key: 'cep', label: 'CEP' },
  { key: 'extenso_numero', label: 'Número por extenso' },
  { key: 'extenso_moeda', label: 'Valor por extenso (reais)' },
  { key: 'extenso_data', label: 'Data por extenso' },
];

// Catálogo de campos disponíveis para mapeamento de origem.
export const PLACEHOLDER_FONTES: { key: string; label: string; grupo: string }[] = [
  // Cliente
  { key: 'cliente.razao_social', label: 'Cliente · Razão Social', grupo: 'Cliente' },
  { key: 'cliente.nome_fantasia', label: 'Cliente · Nome Fantasia', grupo: 'Cliente' },
  { key: 'cliente.cnpj', label: 'Cliente · CNPJ', grupo: 'Cliente' },
  { key: 'cliente.email', label: 'Cliente · E-mail', grupo: 'Cliente' },
  { key: 'cliente.telefone', label: 'Cliente · Telefone', grupo: 'Cliente' },
  { key: 'cliente.cep', label: 'Cliente · CEP', grupo: 'Cliente' },
  { key: 'cliente.cidade', label: 'Cliente · Cidade', grupo: 'Cliente' },
  { key: 'cliente.estado', label: 'Cliente · Estado', grupo: 'Cliente' },
  { key: 'cliente.__endereco', label: 'Cliente · Endereço completo (formatado)', grupo: 'Cliente' },
  { key: 'cliente.representante_legal', label: 'Cliente · Representante Legal', grupo: 'Cliente' },
  { key: 'cliente.cpf_representante', label: 'Cliente · CPF do Representante', grupo: 'Cliente' },
  // Contrato
  { key: 'contrato.numero_proposta', label: 'Contrato · Nº Proposta', grupo: 'Contrato' },
  { key: 'contrato.numero_contrato', label: 'Contrato · Nº Contrato', grupo: 'Contrato' },
  { key: 'contrato.valor_mensal', label: 'Contrato · Valor Mensal', grupo: 'Contrato' },
  { key: 'contrato.qtd_vidas', label: 'Contrato · Quantidade de Vidas', grupo: 'Contrato' },
  { key: 'contrato.valor_excedente', label: 'Contrato · Valor Excedente', grupo: 'Contrato' },
  { key: 'contrato.dia_cobranca', label: 'Contrato · Dia de Cobrança', grupo: 'Contrato' },
  { key: 'contrato.multa', label: 'Contrato · Multa (%)', grupo: 'Contrato' },
  { key: 'contrato.juros', label: 'Contrato · Juros (%)', grupo: 'Contrato' },
  { key: 'contrato.vigencia_meses', label: 'Contrato · Vigência (meses)', grupo: 'Contrato' },
  { key: 'contrato.indice_reajuste', label: 'Contrato · Índice de Reajuste', grupo: 'Contrato' },
  { key: 'contrato.prazo_aviso', label: 'Contrato · Prazo Aviso Prévio', grupo: 'Contrato' },
  { key: 'contrato.valor_km', label: 'Contrato · Valor KM Rodado', grupo: 'Contrato' },
  { key: 'contrato.data_emissao', label: 'Contrato · Data de Emissão', grupo: 'Datas' },
  { key: 'contrato.data_assinatura', label: 'Contrato · Data de Assinatura', grupo: 'Datas' },
  { key: 'contrato.data_inicio', label: 'Contrato · Início da Vigência', grupo: 'Datas' },
  { key: 'contrato.data_fim', label: 'Contrato · Fim da Vigência', grupo: 'Datas' },
  { key: 'contrato.rep_nome', label: 'Assinante · Representante Legal', grupo: 'Assinantes' },
  { key: 'contrato.rep_cpf', label: 'Assinante · CPF Representante', grupo: 'Assinantes' },
  { key: 'contrato.testemunha1_nome', label: 'Assinante · Testemunha 1', grupo: 'Assinantes' },
  { key: 'contrato.testemunha1_cpf', label: 'Assinante · CPF Testemunha 1', grupo: 'Assinantes' },
  { key: 'contrato.testemunha2_nome', label: 'Assinante · Testemunha 2', grupo: 'Assinantes' },
  { key: 'contrato.testemunha2_cpf', label: 'Assinante · CPF Testemunha 2', grupo: 'Assinantes' },
];

export function useContractPlaceholders(onlyActive = true) {
  return useQuery({
    queryKey: ['contract_placeholders', onlyActive],
    queryFn: async () => {
      let q = supabase.from('contract_placeholders').select('*').order('grupo').order('ordem').order('label');
      if (onlyActive) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ContractPlaceholder[];
    },
  });
}
