import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OSCusto, OSCustoInput } from '@/types/osCustos';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useOSCustos(ordemId: string | null | undefined) {
  const { user } = useAuth();
  const [custos, setCustos] = useState<OSCusto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCustos = useCallback(async () => {
    if (!ordemId) { setCustos([]); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('os_custos')
        .select('*')
        .eq('ordem_id', ordemId)
        .order('data', { ascending: false });
      if (error) throw error;
      setCustos((data || []) as OSCusto[]);
    } catch (e: any) {
      console.error('Erro ao carregar custos', e);
      toast({ title: 'Erro', description: 'Não foi possível carregar os custos.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [ordemId]);

  useEffect(() => { fetchCustos(); }, [fetchCustos]);

  const addCusto = async (input: OSCustoInput) => {
    try {
      const { error } = await supabase.from('os_custos').insert({
        ...input,
        servico_os_id: input.servico_os_id || null,
        profissional_id: input.profissional_id || null,
        fornecedor: input.fornecedor || null,
        observacoes: input.observacoes || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
      await fetchCustos();
      toast({ title: 'Custo lançado', description: 'Custo adicionado à OS.' });
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao lançar custo: ' + (e.message || ''), variant: 'destructive' });
      return false;
    }
  };

  const deleteCusto = async (id: string) => {
    try {
      const { error } = await supabase.from('os_custos').delete().eq('id', id);
      if (error) throw error;
      await fetchCustos();
      toast({ title: 'Custo removido' });
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao remover custo (apenas ADM Master pode excluir).', variant: 'destructive' });
      return false;
    }
  };

  const totalCustos = custos.reduce((sum, c) => sum + Number(c.valor || 0), 0);

  return { custos, isLoading, addCusto, deleteCusto, totalCustos, refetch: fetchCustos };
}
