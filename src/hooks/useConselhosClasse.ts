import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface ConselhoClasse {
  id: string;
  sigla: string;
  descricao: string | null;
  ativo: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useConselhosClasse() {
  const { user } = useAuth();
  const [conselhos, setConselhos] = useState<ConselhoClasse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('conselhos_classe')
      .select('*')
      .eq('ativo', true)
      .order('sigla');
    if (error) {
      console.error('Erro ao carregar conselhos:', error);
    } else {
      setConselhos((data || []) as ConselhoClasse[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (sigla: string, descricao?: string): Promise<ConselhoClasse | null> => {
    const siglaUp = sigla.trim().toUpperCase();
    if (!siglaUp) return null;
    const { data, error } = await supabase
      .from('conselhos_classe')
      .insert({
        sigla: siglaUp,
        descricao: descricao || null,
        is_default: false,
        created_by: user?.id || null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao cadastrar conselho: ' + error.message, variant: 'destructive' });
      return null;
    }
    await fetch();
    toast({ title: 'Sucesso', description: `Conselho ${siglaUp} cadastrado.` });
    return data as ConselhoClasse;
  };

  return { conselhos, isLoading, add, refresh: fetch };
}
