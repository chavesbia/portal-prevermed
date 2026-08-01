import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResponsavelTecnico, TipoLaudo, Laudo, ConfiguracaoAlerta, ConselhoProfissional } from '@/types/os';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useResponsaveisTecnicos() {
  const [data, setData] = useState<ResponsavelTecnico[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('responsaveis_tecnicos')
      .select('*')
      .order('nome');
    if (error) {
      console.error('Erro ao carregar responsáveis:', error);
    } else {
      setData((rows || []) as ResponsavelTecnico[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { responsaveis: data, isLoading, refresh: fetch };
}

export function useTiposLaudo() {
  const [data, setData] = useState<TipoLaudo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('tipos_laudo')
      .select('*')
      .order('nome');
    if (error) {
      console.error('Erro ao carregar tipos de laudo:', error);
    } else {
      setData((rows || []) as TipoLaudo[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (item: Omit<TipoLaudo, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('tipos_laudo').insert(item as any);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao cadastrar tipo de laudo.', variant: 'destructive' });
      return false;
    }
    await fetch();
    toast({ title: 'Sucesso', description: 'Tipo de laudo cadastrado.' });
    return true;
  };

  const update = async (id: string, updates: Partial<TipoLaudo>) => {
    const { error } = await supabase.from('tipos_laudo').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar tipo de laudo.', variant: 'destructive' });
      return false;
    }
    await fetch();
    toast({ title: 'Sucesso', description: 'Tipo de laudo atualizado.' });
    return true;
  };

  return { tiposLaudo: data, isLoading, add, update, refresh: fetch };
}

export function useLaudos() {
  const { user } = useAuth();
  const [data, setData] = useState<Laudo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('laudos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao carregar laudos:', error);
    } else {
      setData((rows || []) as Laudo[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (item: Omit<Laudo, 'id' | 'created_at' | 'updated_at'>) => {
    const payload = { ...item, created_by: user?.id || null };
    const { error } = await supabase.from('laudos').insert(payload as any);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao registrar laudo.', variant: 'destructive' });
      return false;
    }
    await fetch();
    toast({ title: 'Sucesso', description: 'Laudo registrado com sucesso.' });
    return true;
  };

  return { laudos: data, isLoading, add, refresh: fetch };
}

export function useConfiguracaoAlertas() {
  const [data, setData] = useState<ConfiguracaoAlerta | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('configuracao_alertas')
      .select('*')
      .is('tipo_laudo_id', null)
      .limit(1);
    if (!error && rows && rows.length > 0) {
      setData(rows[0] as ConfiguracaoAlerta);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const update = async (updates: { dias_antecedencia: number[]; ativo: boolean }) => {
    if (!data) return false;
    const { error } = await supabase.from('configuracao_alertas').update(updates as any).eq('id', data.id);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar configuração.', variant: 'destructive' });
      return false;
    }
    await fetch();
    toast({ title: 'Sucesso', description: 'Configuração de alertas atualizada.' });
    return true;
  };

  return { config: data, isLoading, update, refresh: fetch };
}
