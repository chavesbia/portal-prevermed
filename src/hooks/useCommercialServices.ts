import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CommercialService {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientService {
  id: string;
  client_id: string;
  service_id: string;
  service?: CommercialService;
}

export function useCommercialServices() {
  const qc = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['commercial-services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_services')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as CommercialService[];
    },
  });

  const createService = useMutation({
    mutationFn: async (s: Partial<CommercialService>) => {
      const { data, error } = await supabase
        .from('commercial_services')
        .insert(s as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial-services'] });
      toast({ title: 'Serviço criado' });
    },
    onError: (e: any) => toast({ title: 'Erro ao criar', description: e?.message, variant: 'destructive' }),
  });

  const updateService = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CommercialService> & { id: string }) => {
      const { data, error } = await supabase
        .from('commercial_services')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial-services'] });
      toast({ title: 'Serviço atualizado' });
    },
    onError: (e: any) => toast({ title: 'Erro ao atualizar', description: e?.message, variant: 'destructive' }),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commercial_services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial-services'] });
      toast({ title: 'Serviço removido' });
    },
    onError: (e: any) => toast({ title: 'Erro ao remover', description: e?.message, variant: 'destructive' }),
  });

  return { services, isLoading, createService, updateService, deleteService };
}

export function useClientServices(clientId: string | undefined) {
  const qc = useQueryClient();

  const { data: clientServices = [], isLoading } = useQuery({
    queryKey: ['client-services', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('commercial_client_services')
        .select('id, client_id, service_id, service:commercial_services(*)')
        .eq('client_id', clientId);
      if (error) throw error;
      return data as ClientService[];
    },
    enabled: !!clientId,
  });

  const setServices = useMutation({
    mutationFn: async (serviceIds: string[]) => {
      if (!clientId) return;
      // Replace all: delete then insert
      const { error: delErr } = await supabase
        .from('commercial_client_services')
        .delete()
        .eq('client_id', clientId);
      if (delErr) throw delErr;
      if (serviceIds.length > 0) {
        const rows = serviceIds.map(sid => ({ client_id: clientId, service_id: sid }));
        const { error: insErr } = await supabase
          .from('commercial_client_services')
          .insert(rows as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-services', clientId] });
      toast({ title: 'Serviços contratados atualizados' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  return { clientServices, isLoading, setServices };
}
