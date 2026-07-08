import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OSProdutividadeRow {
  responsavel: string;
  total_os: number;
  os_encerradas: number;
  os_em_andamento: number;
  os_atrasadas: number;
  total_servicos: number;
  servicos_encerrados: number;
  tempo_medio_dias: number | null;
}

export function useOSProdutividade() {
  const [rows, setRows] = useState<OSProdutividadeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from('vw_os_produtividade')
      .select('*')
      .order('total_os', { ascending: false });
    if (!error) setRows((data || []) as OSProdutividadeRow[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { rows, isLoading, refetch: fetch };
}
