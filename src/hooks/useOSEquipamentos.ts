import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { OSEquipamento, OSEquipamentoHistorico, EquipamentoStatus } from '@/types/osVisitas';

export interface EquipamentoInput {
  nome: string;
  tipo?: string | null;
  empresa_cliente: string;
  localizacao?: string | null;
  status: EquipamentoStatus;
  observacoes?: string | null;
}

export function useOSEquipamentos() {
  const { user, profile } = useAuth();
  const [equipamentos, setEquipamentos] = useState<OSEquipamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEquipamentos = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('os_equipamentos')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      setEquipamentos((data || []) as OSEquipamento[]);
    } catch (e: any) {
      console.error('Erro ao carregar equipamentos:', e);
      toast({ title: 'Erro', description: 'Erro ao carregar equipamentos.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEquipamentos(); }, [fetchEquipamentos]);

  const addEquipamento = async (input: EquipamentoInput) => {
    try {
      const { data, error } = await supabase
        .from('os_equipamentos')
        .insert({ ...input, created_by: user?.id || null })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('os_equipamento_historico').insert({
        equipamento_id: data.id,
        user_id: user?.id || null,
        user_name: profile?.full_name || 'Sistema',
        acao: 'Cadastro',
        comentario: `Equipamento cadastrado para ${input.empresa_cliente}.`,
      });

      await fetchEquipamentos();
      toast({ title: 'Sucesso', description: 'Equipamento cadastrado.' });
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao cadastrar equipamento: ' + (e.message || ''), variant: 'destructive' });
      return false;
    }
  };

  const updateEquipamento = async (id: string, input: Partial<EquipamentoInput>) => {
    try {
      const { error } = await supabase
        .from('os_equipamentos')
        .update({ ...input, updated_by: user?.id || null })
        .eq('id', id);
      if (error) throw error;

      await supabase.from('os_equipamento_historico').insert({
        equipamento_id: id,
        user_id: user?.id || null,
        user_name: profile?.full_name || 'Sistema',
        acao: 'Atualização',
        comentario: 'Dados do equipamento atualizados.',
      });

      await fetchEquipamentos();
      toast({ title: 'Sucesso', description: 'Equipamento atualizado.' });
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao atualizar equipamento.', variant: 'destructive' });
      return false;
    }
  };

  const deleteEquipamento = async (id: string) => {
    try {
      const { error } = await supabase.from('os_equipamentos').delete().eq('id', id);
      if (error) throw error;
      await fetchEquipamentos();
      toast({ title: 'Sucesso', description: 'Equipamento removido.' });
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao remover equipamento.', variant: 'destructive' });
      return false;
    }
  };

  const getHistorico = async (equipamentoId: string): Promise<OSEquipamentoHistorico[]> => {
    const { data, error } = await supabase
      .from('os_equipamento_historico')
      .select('*')
      .eq('equipamento_id', equipamentoId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao carregar histórico de equipamento:', error);
      return [];
    }
    return (data || []) as OSEquipamentoHistorico[];
  };

  return { equipamentos, isLoading, addEquipamento, updateEquipamento, deleteEquipamento, getHistorico, fetchEquipamentos };
}
