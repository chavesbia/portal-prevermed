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
  servico_id?: string | null;
  data_visita: string;
  hora_visita?: string | null;
  responsavel_id?: string | null;
  responsavel_nome: string;
  tipo_visita: VisitaTipo;
  endereco?: string | null;
  observacoes?: string | null;
  custos_deslocamento?: number;
  urgente?: boolean;
  motivo_urgencia?: string | null;
  equipamentos_ids?: string[];
}

export function useOSVisitas() {
  const { user } = useAuth();
  const [visitas, setVisitas] = useState<OSVisita[]>([]);
  const [visitaEquipamentos, setVisitaEquipamentos] = useState<Record<string, string[]>>({});
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
      setVisitas((data || []) as unknown as OSVisita[]);

      const { data: links } = await supabase
        .from('os_visita_equipamentos')
        .select('visita_id, equipamento_id');
      const map: Record<string, string[]> = {};
      (links || []).forEach((l: any) => {
        if (!map[l.visita_id]) map[l.visita_id] = [];
        map[l.visita_id].push(l.equipamento_id);
      });
      setVisitaEquipamentos(map);
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
          servico_id: input.servico_id || null,
          data_visita: input.data_visita,
          hora_visita: input.hora_visita || null,
          responsavel_id: input.responsavel_id || null,
          responsavel_nome: input.responsavel_nome,
          tipo_visita: input.tipo_visita,
          status: 'agendada' as VisitaStatus,
          endereco: input.endereco || null,
          observacoes: input.observacoes || null,
          custos_deslocamento: input.custos_deslocamento || 0,
          urgente: input.urgente || false,
          motivo_urgencia: input.motivo_urgencia || null,
          created_by: user?.id || null,
        } as any)
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

  const updateVisita = async (id: string, input: NovaVisitaInput) => {
    try {
      const { error } = await supabase.from('os_visitas').update({
        empresa_cliente: input.empresa_cliente,
        ordem_id: input.ordem_id || null,
        numero_os: input.numero_os || null,
        servico_id: input.servico_id || null,
        data_visita: input.data_visita,
        hora_visita: input.hora_visita || null,
        responsavel_id: input.responsavel_id || null,
        responsavel_nome: input.responsavel_nome,
        tipo_visita: input.tipo_visita,
        endereco: input.endereco || null,
        observacoes: input.observacoes || null,
        custos_deslocamento: input.custos_deslocamento || 0,
        urgente: input.urgente || false,
        motivo_urgencia: input.motivo_urgencia || null,
        updated_by: user?.id || null,
      } as any).eq('id', id);
      if (error) throw error;

      // Substitui vínculos de equipamentos
      await supabase.from('os_visita_equipamentos').delete().eq('visita_id', id);
      if (input.equipamentos_ids?.length) {
        await supabase.from('os_visita_equipamentos').insert(
          input.equipamentos_ids.map(eid => ({ visita_id: id, equipamento_id: eid }))
        );
      }

      await fetchVisitas();
      toast({ title: 'Sucesso', description: 'Visita atualizada.' });
      return true;
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Erro ao atualizar visita: ' + (e.message || ''), variant: 'destructive' });
      return false;
    }
  };

  const updateVisitaStatus = async (id: string, status: VisitaStatus, motivo?: string, custoReal?: number) => {
    try {
      const payload: any = {
        status,
        motivo_cancelamento: status === 'cancelada' ? (motivo || null) : null,
        updated_by: user?.id || null,
      };
      if (status === 'realizada' && typeof custoReal === 'number') payload.custo_real = custoReal;
      const { error } = await supabase.from('os_visitas').update(payload).eq('id', id);
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

  /**
   * Detecta conflitos de agendamento:
   *  - error: mesmo Elaborador/Executor sobreposto (buffer de deslocamento);
   *  - error: equipamento já reservado no mesmo dia;
   *  - warn : muitos elaboradores fora no mesmo dia (>= threshold).
   */
  const detectConflitos = useCallback((
    dataISO: string,
    equipamentosIds: string[],
    responsavelId?: string | null,
    horaVisita?: string | null,
    excludeVisitaId?: string,
    opts?: { bufferMin?: number; maxProfsPorDia?: number },
  ): { severity: 'error' | 'warn'; message: string }[] => {
    if (!dataISO) return [];
    const bufferMin = opts?.bufferMin ?? 60;
    const maxProfs = opts?.maxProfsPorDia ?? 3;
    const conflitos: { severity: 'error' | 'warn'; message: string }[] = [];

    const toMin = (h?: string | null) => {
      if (!h) return null;
      const [hh, mm] = h.split(':').map(Number);
      return (hh || 0) * 60 + (mm || 0);
    };
    const newHora = toMin(horaVisita);

    const mesmoDia = visitas.filter(v =>
      v.id !== excludeVisitaId &&
      v.status === 'agendada' &&
      v.data_visita === dataISO,
    );

    // 1) Sobreposição do mesmo Elaborador/Executor
    if (responsavelId) {
      mesmoDia
        .filter(v => v.responsavel_id === responsavelId)
        .forEach(v => {
          const outraHora = toMin(v.hora_visita);
          if (newHora != null && outraHora != null) {
            if (Math.abs(newHora - outraHora) < bufferMin) {
              conflitos.push({
                severity: 'error',
                message: `Elaborador/Executor já agendado às ${v.hora_visita}${v.numero_os ? ` (OS #${v.numero_os})` : ''}. Buffer mínimo: ${bufferMin} min.`,
              });
            }
          } else {
            conflitos.push({
              severity: 'error',
              message: `Elaborador/Executor já possui visita neste dia${v.numero_os ? ` (OS #${v.numero_os})` : ''}. Defina horários para permitir conciliar.`,
            });
          }
        });
    }

    // 2) Reserva de equipamento
    if (equipamentosIds.length > 0) {
      mesmoDia.forEach(v => {
        const eqsDaVisita = visitaEquipamentos[v.id] || [];
        equipamentosIds.forEach(eid => {
          if (eqsDaVisita.includes(eid)) {
            conflitos.push({
              severity: 'error',
              message: `Equipamento já reservado por ${v.responsavel_nome}${v.numero_os ? ` na OS #${v.numero_os}` : ''}.`,
            });
          }
        });
      });
    }

    // 3) Muitos profissionais fora no mesmo dia
    const profsDoDia = new Set(mesmoDia.map(v => v.responsavel_id).filter(Boolean) as string[]);
    if (responsavelId) profsDoDia.add(responsavelId);
    if (profsDoDia.size >= maxProfs) {
      conflitos.push({
        severity: 'warn',
        message: `${profsDoDia.size} elaboradores/executores agendados neste dia. Confirme cobertura interna.`,
      });
    }

    // Dedup por mensagem
    const seen = new Set<string>();
    return conflitos.filter(c => {
      const k = c.severity + '|' + c.message;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [visitas, visitaEquipamentos]);


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

  return {
    visitas,
    visitaEquipamentos,
    isLoading,
    filters,
    setFilters,
    getFiltered,
    addVisita,
    updateVisitaStatus,
    deleteVisita,
    detectConflitos,
    fetchVisitas,
  };
}
