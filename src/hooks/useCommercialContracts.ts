import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type ModeloContratual = 'Gestão Ocupacional' | 'Parceira' | 'Por Uso';

export interface CommercialContract {
  id: string;
  client_id: string;
  contract_number: string | null;
  proposal_number: string | null;
  prospect_status: string | null;
  modelo_contratual: ModeloContratual | null;
  contract_year: number | null;
  start_date: string | null;
  end_date: string | null;
  signed: boolean;
  auto_renewal: boolean;
  renewal_term_months: number | null;
  has_exam_table: boolean;
  has_service_table: boolean;
  is_current: boolean;
  status_derivado: string | null;
  revisao_pendente: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCommercialContracts(clientId: string | undefined) {
  const qc = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['commercial-contracts', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('commercial_contracts' as any)
        .select('*')
        .eq('client_id', clientId)
        .order('is_current', { ascending: false })
        .order('start_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CommercialContract[];
    },
    enabled: !!clientId,
  });

  const createContract = useMutation({
    mutationFn: async (payload: Partial<CommercialContract>) => {
      const { data, error } = await supabase
        .from('commercial_contracts' as any)
        .insert({ ...payload, client_id: clientId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial-contracts', clientId] });
      toast({ title: 'Contrato criado' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const updateContract = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CommercialContract> & { id: string }) => {
      const { error } = await supabase
        .from('commercial_contracts' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial-contracts', clientId] });
      toast({ title: 'Contrato atualizado' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commercial_contracts' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial-contracts', clientId] });
      toast({ title: 'Contrato removido' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const setCurrent = useMutation({
    mutationFn: async (id: string) => {
      if (!clientId) throw new Error('clientId ausente');
      // limpa o vigente atual antes de marcar o novo (índice único)
      const { error: e1 } = await supabase
        .from('commercial_contracts' as any)
        .update({ is_current: false } as any)
        .eq('client_id', clientId)
        .eq('is_current', true);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('commercial_contracts' as any)
        .update({ is_current: true } as any)
        .eq('id', id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial-contracts', clientId] });
      toast({ title: 'Contrato vigente atualizado' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const renewCurrent = useMutation({
    mutationFn: async (newEnd: string) => {
      const current = contracts.find(c => c.is_current);
      if (!current) throw new Error('Nenhum contrato vigente para renovar');
      // marca vigente como não vigente
      const { error: e1 } = await supabase
        .from('commercial_contracts' as any)
        .update({ is_current: false, status_derivado: 'Renovado' } as any)
        .eq('id', current.id);
      if (e1) throw e1;
      const newStart = current.end_date || new Date().toISOString().slice(0, 10);
      const { error: e2 } = await supabase
        .from('commercial_contracts' as any)
        .insert({
          client_id: current.client_id,
          contract_number: current.contract_number,
          modelo_contratual: current.modelo_contratual,
          contract_year: new Date().getFullYear(),
          start_date: newStart,
          end_date: newEnd,
          signed: false,
          auto_renewal: current.auto_renewal,
          renewal_term_months: current.renewal_term_months,
          has_exam_table: current.has_exam_table,
          has_service_table: current.has_service_table,
          is_current: true,
          status_derivado: 'Aguardando assinatura',
          notes: `Renovação do contrato ${current.contract_number || ''}`.trim(),
        } as any);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial-contracts', clientId] });
      toast({ title: 'Contrato renovado' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  return { contracts, isLoading, createContract, updateContract, deleteContract, setCurrent, renewCurrent };
}
