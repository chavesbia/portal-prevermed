import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OSFinanceiroRow } from '@/types/os';
import { toast } from '@/hooks/use-toast';

export function useOSFinanceiro() {
  const [rows, setRows] = useState<OSFinanceiroRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vw_os_financeiro' as any)
        .select('*')
        .order('data_registro', { ascending: false });
      if (error) throw error;
      setRows((data || []) as unknown as OSFinanceiroRow[]);
    } catch (e: any) {
      console.error('Erro ao carregar financeiro OS', e);
      toast({ title: 'Erro', description: 'Erro ao carregar dados financeiros.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  return { rows, isLoading, refetch: fetchRows };
}

export async function updateOSFinanceiro(
  ordemId: string,
  updates: {
    receita_prevista?: number | null;
    orcamento_custo?: number | null;
    contrato_id?: string | null;
    quotation_id?: string | null;
  },
) {
  const { error } = await supabase
    .from('ordens_servico')
    .update(updates)
    .eq('id', ordemId);
  if (error) throw error;
}
