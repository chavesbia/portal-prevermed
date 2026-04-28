import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CommercialClient {
  id: string;
  company_name: string;
  legal_name: string | null;
  cnpj: string | null;
  soc_code: string | null;
  city: string | null;
  state: string | null;
  active_lives: number;
  subgroup: string;
  risk_grade: string;
  has_contract: boolean;
  contract_signed: boolean;
  contract_number: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  proposal_approved: boolean;
  proposal_number: string | null;
  approval_date: string | null;
  services_summary: string | null;
  pricing_table_attached: boolean;
  notes: string | null;
  contract_notes: string | null;
  contact_name: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  revisado: boolean;
  revisado_em: string | null;
  revisado_por: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientAttachment {
  id: string;
  client_id: string;
  type: 'contrato' | 'proposta' | 'tabela';
  file_url: string;
  file_name: string | null;
  created_by: string | null;
  created_at: string;
}

export function useCommercialClients() {
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['commercial-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_clients')
        .select('*')
        .order('company_name');
      if (error) throw error;
      return data as CommercialClient[];
    },
  });

  const createClient = useMutation({
    mutationFn: async (client: Partial<CommercialClient>) => {
      const { data, error } = await supabase
        .from('commercial_clients')
        .insert(client as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-clients'] });
      toast({ title: 'Cliente criado com sucesso' });
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      if (msg.includes('idx_commercial_clients_cnpj')) {
        toast({ title: 'Erro', description: 'CNPJ já cadastrado', variant: 'destructive' });
      } else if (msg.includes('idx_commercial_clients_soc_code')) {
        toast({ title: 'Erro', description: 'Código SOC já cadastrado', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao criar cliente', description: msg, variant: 'destructive' });
      }
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CommercialClient> & { id: string }) => {
      const { data, error } = await supabase
        .from('commercial_clients')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-clients'] });
      toast({ title: 'Cliente atualizado com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar', description: err?.message, variant: 'destructive' });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commercial_clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-clients'] });
      toast({ title: 'Cliente removido' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao remover', description: err?.message, variant: 'destructive' });
    },
  });

  return { clients, isLoading, createClient, updateClient, deleteClient };
}

export function useClientAttachments(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['client-attachments', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_attachments')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientAttachment[];
    },
    enabled: !!clientId,
  });

  const uploadAttachment = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'contrato' | 'proposta' | 'tabela' }) => {
      const filePath = `${clientId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('client-documents')
        .getPublicUrl(filePath);

      const { error } = await supabase.from('client_attachments').insert({
        client_id: clientId,
        type,
        file_url: urlData.publicUrl,
        file_name: file.name,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-attachments', clientId] });
      toast({ title: 'Arquivo anexado com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao anexar', description: err?.message, variant: 'destructive' });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_attachments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-attachments', clientId] });
      toast({ title: 'Anexo removido' });
    },
  });

  return { attachments, isLoading, uploadAttachment, deleteAttachment };
}
