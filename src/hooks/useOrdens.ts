import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OrdemServico, ServicoOS, HistoricoOS, OSFilters, StatusOS, TipoOS, StatusServico } from '@/types/os';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionais } from '@/hooks/useProfissionais';
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

const ITEMS_PER_PAGE = 25;

export function useOrdens() {
  const { user, profile } = useAuth();
  const { profissionais } = useProfissionais();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<OSFilters>(defaultFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchOrdens = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('ordens_servico')
        .select('*', { count: 'exact' });

      // Apply filters to count and fetch
      if (filters.search) {
        const s = filters.search.toLowerCase();
        // Since we are filtering in the database now, we need to handle search properly
        // Note: empresa_cliente is text, numero_os is text
        query = query.or(`empresa_cliente.ilike.%${s}%,numero_os.ilike.%${s}%`);
      }
      
      if (filters.status_os && filters.status_os !== 'all') {
        query = query.eq('status_os', filters.status_os);
      }

      if (filters.periodo_inicio) {
        query = query.gte('data_registro', filters.periodo_inicio.toISOString());
      }
      if (filters.periodo_fim) {
        query = query.lte('data_registro', filters.periodo_fim.toISOString());
      }

      // Pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTotalCount(count || 0);

      // Fetch servicos for the current page ordens
      const ordemIds = (data || []).map(o => o.id);
      let servicos: ServicoOS[] = [];
      if (ordemIds.length > 0) {
        let svcQuery = supabase
          .from('servicos_os')
          .select('*')
          .in('ordem_id', ordemIds);
        
        const { data: svcData, error: svcError } = await svcQuery;
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
  }, [filters, currentPage]);

  useEffect(() => {
    fetchOrdens();
  }, [fetchOrdens]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const getFilteredOrdens = useCallback(() => {
    // The main filtering is now done server-side in fetchOrdens.
    // However, some filters might still be applied here if we can't do them in SQL easily.
    // For now, return the current page of ordens.
    return ordens;
  }, [ordens]);

  const addOrdem = async (data: {
    numero_os: string;
    company_id?: string | null;
    empresa_cliente: string;
    contato_cliente?: string;
    responsavel_atual: string;
    status_os: StatusOS;
    data_registro: string;
    data_emissao?: string | null;
    prazo_acordado?: string | null;
    observacoes?: string;
    urgente?: boolean;
    motivo_urgencia?: string | null;
    servicos: { tipo: string; tipo_os: TipoOS; status: StatusServico }[];
  }) => {
    try {
      const tipo_servico_resumo = data.servicos.map(s => s.tipo).join('/');

      const { data: inserted, error } = await supabase
        .from('ordens_servico')
        .insert({
          numero_os: data.numero_os,
          company_id: data.company_id || null,
          empresa_cliente: data.empresa_cliente,
          contato_cliente: data.contato_cliente || null,
          responsavel_atual: data.responsavel_atual,
          status_os: data.status_os,
          data_registro: data.data_registro,
          data_emissao: data.data_emissao || null,
          prazo_acordado: data.prazo_acordado || null,
          observacoes: data.observacoes || null,
          urgente: data.urgente || false,
          motivo_urgencia: data.motivo_urgencia || null,
          tipo_servico_resumo,
          created_by: user?.id || null,
        } as any)
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
      urgente?: boolean;
      motivo_urgencia?: string | null;
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
          urgente: data.urgente ?? false,
          motivo_urgencia: data.motivo_urgencia ?? null,
          updated_by: user?.id || null,
        } as any)
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
    const set = new Set<string>();
    ordens.forEach(o => {
      (o.servicos || []).forEach(s => {
        const p = profissionais.find(pr => pr.id === s.responsavel_id);
        if (p?.nome) set.add(p.nome);
      });
    });
    return Array.from(set).sort();
  }, [ordens, profissionais]);

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
    currentPage,
    setCurrentPage,
    totalCount,
    totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
  };
}
