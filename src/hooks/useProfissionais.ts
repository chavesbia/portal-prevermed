import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Profissional } from '@/types/profissionais';

/**
 * Store compartilhado entre todas as instâncias do hook.
 * Sem isso, cada componente (lista, diálogo, seletor) tinha sua própria cópia
 * e uma edição salva no diálogo não refletia na lista/objeto selecionado.
 */
let cache: Profissional[] = [];
let loading = true;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

async function loadAll(): Promise<void> {
  if (inflight) return inflight;
  loading = true;
  emit();
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('profissionais')
        .select('*, conselhos_classe:conselho_id(sigla)')
        .order('nome');
      if (error) throw error;
      cache = (data || []).map((p: any) => ({
        ...p,
        conselho_sigla: p.conselhos_classe?.sigla ?? null,
      })) as Profissional[];
    } catch (e: any) {
      console.error('Erro ao carregar profissionais:', e);
      toast({ title: 'Erro', description: 'Não foi possível carregar profissionais.', variant: 'destructive' });
    } finally {
      loading = false;
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

export function useProfissionais() {
  const { user } = useAuth();
  const [, forceRender] = useState(0);

  useEffect(() => {
    const l = () => forceRender(n => n + 1);
    listeners.add(l);
    if (cache.length === 0 && !inflight) loadAll();
    return () => { listeners.delete(l); };
  }, []);

  const fetchAll = useCallback(() => loadAll(), []);

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
    await loadAll();
    return (cache.find(p => p.id === (data as any)?.id) || (data as Profissional)) as Profissional;
  };

  const update = async (id: string, patch: Partial<Profissional>) => {
    const { error } = await supabase.from('profissionais').update(patch as any).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar: ' + error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Profissional atualizado.' });
    await loadAll();
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
    await loadAll();
    return true;
  };

  return { profissionais: cache, isLoading: loading, fetchAll, add, update, toggleAtivo, remove };
}
