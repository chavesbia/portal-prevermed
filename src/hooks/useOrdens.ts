import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OrdemServico, ServicoOS, HistoricoOS, OSFilters, StatusOS, TipoOS, StatusServico } from '@/types/os';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const defaultFilters: OSFilters = {
  search: '',
  status_os: '',
  responsavel: '',
  tipo_servico: '',
  tipo_os: '',
  periodo_inicio: null,
  periodo_fim: null,
};

export function useOrdens() {
  const { user, profile } = useAuth();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<OSFilters>(defaultFilters);

  const fetchOrdens = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch servicos for all ordens
      const ordemIds = (data || []).map(o => o.id);
      let servicos: ServicoOS[] = [];
      if (ordemIds.length > 0) {
        const { data: svcData, error: svcError } = await supabase
          .from('servicos_os')
          .select('*')
          .in('ordem_id', ordemIds);
        if (svcError) throw svcError;
        servicos = (svcData || []) as ServicoOS[];
      }

      const ordensWithServicos = (data || []).map(o => ({
        ...o,
        servicos: servicos.filter(s => s.ordem_id === o.id),
      })) as OrdemServico[];

      setOrdens(ordensWithServicos);
    } catch (error: any) {
      console.error('Erro ao carregar OS:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar ordens de serviço.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdens();
  }, [fetchOrdens]);

  const getFilteredOrdens = useCallback(() => {
    return ordens.filter(ordem => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matchCliente = ordem.empresa_cliente.toLowerCase().includes(s);
        const matchOS = ordem.numero_os.includes(s);
        if (!matchCliente && !matchOS) return false;
      }
      if (filters.status_os && filters.status_os !== 'all' && ordem.status_os !== filters.status_os) return false;
      if (filters.responsavel && filters.responsavel !== 'all' && ordem.responsavel_atual !== filters.responsavel) return false;
      if (filters.tipo_servico && filters.tipo_servico !== 'all') {
        const has = ordem.servicos?.some(s => s.tipo === filters.tipo_servico);
        if (!has) return false;
      }
      if (filters.tipo_os && filters.tipo_os !== 'all') {
        const has = ordem.servicos?.some(s => s.tipo_os === filters.tipo_os);
        if (!has) return false;
      }
      if (filters.periodo_inicio) {
        const reg = new Date(ordem.data_registro);
        if (reg < filters.periodo_inicio) return false;
      }
      if (filters.periodo_fim) {
        const reg = new Date(ordem.data_registro);
        if (reg > filters.periodo_fim) return false;
      }
      return true;
    });
  }, [ordens, filters]);

  const addOrdem = async (data: {
    numero_os: string;
    empresa_cliente: string;
    contato_cliente?: string;
    responsavel_atual: string;
    status_os: StatusOS;
    data_registro: string;
    data_emissao?: string | null;
    prazo_acordado?: string | null;
    observacoes?: string;
    servicos: { tipo: string; tipo_os: TipoOS; status: StatusServico }[];
  }) => {
    try {
      const tipo_servico_resumo = data.servicos.map(s => s.tipo).join('/');

      const { data: inserted, error } = await supabase
        .from('ordens_servico')
        .insert({
          numero_os: data.numero_os,
          empresa_cliente: data.empresa_cliente,
          contato_cliente: data.contato_cliente || null,
          responsavel_atual: data.responsavel_atual,
          status_os: data.status_os,
          data_registro: data.data_registro,
          data_emissao: data.data_emissao || null,
          prazo_acordado: data.prazo_acordado || null,
          observacoes: data.observacoes || null,
          tipo_servico_resumo,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert services
      if (data.servicos.length > 0) {
        const { error: svcError } = await supabase
          .from('servicos_os')
          .insert(data.servicos.map(s => ({
            ordem_id: inserted.id,
            tipo: s.tipo,
            tipo_os: s.tipo_os,
            status: s.status,
          })));
        if (svcError) throw svcError;
      }

      // Add history
      await supabase.from('historico_os').insert({
        ordem_id: inserted.id,
        user_id: user?.id || null,
        user_name: profile?.full_name || 'Sistema',
        acao: 'Criação',
        comentario: 'Ordem de serviço criada.',
        status_novo: data.status_os,
      });

      await fetchOrdens();
      toast({ title: 'Sucesso', description: 'OS criada com sucesso!' });
      return true;
    } catch (error: any) {
      console.error('Erro ao criar OS:', error);
      toast({ title: 'Erro', description: 'Erro ao criar OS: ' + (error.message || ''), variant: 'destructive' });
      return false;
    }
  };

  const updateOrdemStatus = async (ordemId: string, newStatus: StatusOS, comentario?: string) => {
    try {
      const ordem = ordens.find(o => o.id === ordemId);
      const oldStatus = ordem?.status_os;

      const { error } = await supabase
        .from('ordens_servico')
        .update({ status_os: newStatus, updated_by: user?.id || null })
        .eq('id', ordemId);
      if (error) throw error;

      await supabase.from('historico_os').insert({
        ordem_id: ordemId,
        user_id: user?.id || null,
        user_name: profile?.full_name || 'Sistema',
        acao: 'Alteração de Status',
        comentario: comentario || `Status alterado para ${newStatus}`,
        status_anterior: oldStatus || null,
        status_novo: newStatus,
      });

      await fetchOrdens();
      return true;
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao atualizar status.', variant: 'destructive' });
      return false;
    }
  };

  const updateOrdem = async (
    ordemId: string,
    data: {
      numero_os: string;
      empresa_cliente: string;
      contato_cliente?: string | null;
      responsavel_atual: string;
      status_os: StatusOS;
      data_registro: string;
      data_emissao?: string | null;
      prazo_acordado?: string | null;
      observacoes?: string | null;
    },
  ) => {
    try {
      const ordem = ordens.find(o => o.id === ordemId);
      const oldStatus = ordem?.status_os;

      const { error } = await supabase
        .from('ordens_servico')
        .update({
          numero_os: data.numero_os,
          empresa_cliente: data.empresa_cliente,
          contato_cliente: data.contato_cliente ?? null,
          responsavel_atual: data.responsavel_atual,
          status_os: data.status_os,
          data_registro: data.data_registro,
          data_emissao: data.data_emissao ?? null,
          prazo_acordado: data.prazo_acordado ?? null,
          observacoes: data.observacoes ?? null,
          updated_by: user?.id || null,
        })
        .eq('id', ordemId);
      if (error) throw error;

      await supabase.from('historico_os').insert({
        ordem_id: ordemId,
        user_id: user?.id || null,
        user_name: profile?.full_name || 'Sistema',
        acao: 'Edição',
        comentario: 'Dados da OS atualizados.',
        status_anterior: oldStatus || null,
        status_novo: data.status_os,
      });

      await fetchOrdens();
      toast({ title: 'Sucesso', description: 'OS atualizada com sucesso!' });
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar OS:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar OS: ' + (error.message || ''), variant: 'destructive' });
      return false;
    }
  };

  const deleteOrdem = async (ordemId: string) => {
    try {
      const { error } = await supabase
        .from('ordens_servico')
        .delete()
        .eq('id', ordemId);
      if (error) throw error;
      await fetchOrdens();
      toast({ title: 'Sucesso', description: 'OS excluída.' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao excluir OS.', variant: 'destructive' });
      return false;
    }
  };

  const getHistorico = async (ordemId: string): Promise<HistoricoOS[]> => {
    const { data, error } = await supabase
      .from('historico_os')
      .select('*')
      .eq('ordem_id', ordemId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao carregar histórico:', error);
      return [];
    }
    return (data || []) as HistoricoOS[];
  };

  const getResponsaveis = useCallback(() => {
    const set = new Set(ordens.map(o => o.responsavel_atual));
    return Array.from(set).sort();
  }, [ordens]);

  return {
    ordens,
    isLoading,
    filters,
    setFilters,
    getFilteredOrdens,
    addOrdem,
    updateOrdem,
    updateOrdemStatus,
    deleteOrdem,
    getHistorico,
    getResponsaveis,
    fetchOrdens,
  };
}
