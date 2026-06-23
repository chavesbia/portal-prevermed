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
}

export const PLACEHOLDER_GRUPOS: { key: string; label: string }[] = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'contrato', label: 'Contrato' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'assinatura', label: 'Assinatura' },
  { key: 'treinamentos', label: 'Treinamentos' },
  { key: 'outros', label: 'Outros' },
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
