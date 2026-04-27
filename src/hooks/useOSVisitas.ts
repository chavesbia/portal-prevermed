import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { OSVisita, VisitaStatus, VisitaTipo } from '@/types/osVisitas';

export interface VisitaFilters {
  search: string;
  status: string;
  responsavel_id: string;
  empresa_cliente: string;
  periodo_inicio: Date | null;
  periodo_fim: Date | null;
}

const defaultFilters: VisitaFilters = {
  search: '',
  status: 'all',
  responsavel_id: 'all',
  empresa_cliente: '',
  periodo_inicio: null,
  periodo_fim: null,
};

export interface NovaVisitaInput {
  empresa_cliente: string;
  ordem_id?: string | null;
  numero_os?: string | null;
  data_visita: string;
  hora_visita?: string | null;
  responsavel_id?: string | null;
  responsavel_nome: string;
  tipo_visita: VisitaTipo;
  endereco?: string | null;
  observacoes?: string | null;
  equipamentos_ids?: string[];
}

export function useOSVisitas() {
  const { user } = useAuth();
  const [visitas, setVisitas] = useState<OSVisita[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<VisitaFilters>(defaultFilters);

  const fetchVisitas = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('os_visitas')
        .select('*')
        .order('data_visita', { ascending: false });
      if (error) throw error;
      setVisitas((data || []) as OSVisita[]);
    } catch (e: any) {
      console.error('Erro ao carregar visitas:', e);
      toast({ title: 'Erro', description: 'Erro ao carregar visitas.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchVisitas(); }, [fetchVisitas]);

  const addVisita = async (input: NovaVisitaInput) => {
    try {
      const { data, error } = await supabase
        .from('os_visitas')
        .insert({
          empresa_cliente: input.empresa_cliente,
          ordem_id: input.ordem_id || null,
          numero_os: input.numero_os || null,
          data_visita: input.data_visita,
          hora_visita: input.hora_visita || null,
          responsavel_id: input.responsavel_id || null,
          responsavel_nome: input.responsavel_nome,
          tipo_visita: input.tipo_visita,
          status: 'agendada' as VisitaStatus,
          endereco: input.endereco || null,
          observacoes: input.observacoes || null,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.equipamentos_ids?.length) {
        await supabase.from('os_visita_equipamentos').insert(
          input.equipamentos_ids.map(eid => ({ visita_id: data.id, equipamento_id: eid }))
        );
      }

      await fetchVisitas();
      toast({ title: 'Sucesso', description: 'Visita agendada.' });
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao agendar visita: ' + (e.message || ''), variant: 'destructive' });
      return false;
    }
  };

  const updateVisitaStatus = async (id: string, status: VisitaStatus, motivo?: string) => {
    try {
      const { error } = await supabase
        .from('os_visitas')
        .update({
          status,
          motivo_cancelamento: status === 'cancelada' ? (motivo || null) : null,
          updated_by: user?.id || null,
        })
        .eq('id', id);
      if (error) throw error;
      await fetchVisitas();
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao atualizar visita.', variant: 'destructive' });
      return false;
    }
  };

  const deleteVisita = async (id: string) => {
    try {
      const { error } = await supabase.from('os_visitas').delete().eq('id', id);
      if (error) throw error;
      await fetchVisitas();
      toast({ title: 'Sucesso', description: 'Visita removida.' });
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao remover visita.', variant: 'destructive' });
      return false;
    }
  };

  const getFiltered = useCallback(() => {
    return visitas.filter(v => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matches =
          v.empresa_cliente.toLowerCase().includes(s) ||
          v.responsavel_nome.toLowerCase().includes(s) ||
          (v.numero_os || '').toLowerCase().includes(s);
        if (!matches) return false;
      }
      if (filters.status !== 'all' && v.status !== filters.status) return false;
      if (filters.responsavel_id !== 'all' && v.responsavel_id !== filters.responsavel_id) return false;
      if (filters.empresa_cliente && !v.empresa_cliente.toLowerCase().includes(filters.empresa_cliente.toLowerCase())) return false;
      if (filters.periodo_inicio) {
        const d = new Date(v.data_visita);
        if (d < filters.periodo_inicio) return false;
      }
      if (filters.periodo_fim) {
        const d = new Date(v.data_visita);
        if (d > filters.periodo_fim) return false;
      }
      return true;
    });
  }, [visitas, filters]);

  return { visitas, isLoading, filters, setFilters, getFiltered, addVisita, updateVisitaStatus, deleteVisita, fetchVisitas };
}
