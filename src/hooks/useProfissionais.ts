import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Profissional } from '@/types/profissionais';

export function useProfissionais() {
  const { user } = useAuth();
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profissionais')
        .select('*, conselhos_classe:conselho_id(sigla)')
        .order('nome');
      if (error) throw error;
      setProfissionais(
        (data || []).map((p: any) => ({
          ...p,
          conselho_sigla: p.conselhos_classe?.sigla ?? null,
        })) as Profissional[],
      );
    } catch (e: any) {
      console.error('Erro ao carregar profissionais:', e);
      toast({ title: 'Erro', description: 'Não foi possível carregar profissionais.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const add = async (input: Omit<Profissional, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'conselho_sigla'>) => {
    const { data, error } = await supabase
      .from('profissionais')
      .insert({ ...input, created_by: user?.id || null } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao cadastrar profissional: ' + error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Sucesso', description: 'Profissional cadastrado.' });
    await fetchAll();
    return data as Profissional;
  };

  const update = async (id: string, patch: Partial<Profissional>) => {
    const { error } = await supabase.from('profissionais').update(patch as any).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar: ' + error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Profissional atualizado.' });
    await fetchAll();
    return true;
  };

  const toggleAtivo = async (id: string, ativo: boolean) => update(id, { ativo });

  const remove = async (id: string) => {
    const { error } = await supabase.from('profissionais').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir: ' + error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Excluído', description: 'Profissional removido.' });
    await fetchAll();
    return true;
  };

  return { profissionais, isLoading, fetchAll, add, update, toggleAtivo, remove };
}
