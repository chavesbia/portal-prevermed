import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AlertaTipo = 'sla' | 'servico_parado' | 'laudo_vencendo' | 'orcamento_estourado';
export type AlertaSeveridade = 'atencao' | 'atrasado';

export interface OSAlerta {
  tipo: AlertaTipo;
  severidade: AlertaSeveridade;
  ordem_id: string;
  numero_os: string;
  empresa_cliente: string;
  responsavel_atual: string;
  referencia_data: string | null;
  descricao: string;
}

export function useOSAlertas() {
  const [alertas, setAlertas] = useState<OSAlerta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from('vw_os_alertas')
      .select('*')
      .order('referencia_data', { ascending: true });
    if (!error) setAlertas((data || []) as OSAlerta[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { alertas, isLoading, refetch: fetch };
}
