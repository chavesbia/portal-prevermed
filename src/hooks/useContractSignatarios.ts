import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SignatarioTipo = 'responsavel_prevermed' | 'testemunha';

export interface ContractSignatario {
  id: string;
  tipo: SignatarioTipo;
  nome: string;
  cpf: string;
  email: string | null;
  cargo: string | null;
  ativo: boolean;
}

export function useContractSignatarios(tipo?: SignatarioTipo, onlyActive = true) {
  return useQuery({
    queryKey: ['contract_signatarios', tipo || 'all', onlyActive],
    queryFn: async () => {
      let q = supabase.from('contract_signatarios' as any).select('*').order('nome');
      if (tipo) q = q.eq('tipo', tipo);
      if (onlyActive) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ContractSignatario[];
    },
  });
}
