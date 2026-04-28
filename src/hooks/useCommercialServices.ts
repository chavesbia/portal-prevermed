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
  is_package: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientService {
  id: string;
  client_id: string;
  service_id: string;
  service?: CommercialService;
}

export interface ServiceComponent {
  id: string;
  package_id: string;
  component_id: string;
  component?: CommercialService;
}

export interface ClientServiceModule {
  id: string;
  client_id: string;
  package_id: string;
  component_id: string;
  is_active: boolean;
  notes: string | null;
}

/** Normaliza categoria: trim + UPPERCASE; vazio => null */
export function normalizeCategory(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = String(input).trim().toUpperCase();
  return v || null;
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
      const payload: any = { ...s, category: normalizeCategory(s.category as any) };
      const { data, error } = await supabase
        .from('commercial_services')
        .insert(payload)
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
      const payload: any = { ...updates };
      if ('category' in updates) payload.category = normalizeCategory(updates.category as any);
      const { data, error } = await supabase
        .from('commercial_services')
        .update(payload)
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

/** Componentes padrão de um pacote (catálogo) */
export function usePackageComponents(packageId: string | undefined) {
  const qc = useQueryClient();

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['service-components', packageId],
    queryFn: async () => {
      if (!packageId) return [];
      const { data, error } = await supabase
        .from('commercial_service_components')
        .select('id, package_id, component_id, component:commercial_services!commercial_service_components_component_id_fkey(*)')
        .eq('package_id', packageId);
      if (error) throw error;
      return data as ServiceComponent[];
    },
    enabled: !!packageId,
  });

  const setComponents = useMutation({
    mutationFn: async (componentIds: string[]) => {
      if (!packageId) return;
      const { error: delErr } = await supabase
        .from('commercial_service_components')
        .delete()
        .eq('package_id', packageId);
      if (delErr) throw delErr;
      if (componentIds.length > 0) {
        const rows = componentIds.map(cid => ({ package_id: packageId, component_id: cid }));
        const { error: insErr } = await supabase
          .from('commercial_service_components')
          .insert(rows as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-components', packageId] });
      toast({ title: 'Componentes do pacote atualizados' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  return { components, isLoading, setComponents };
}

/** Hook utilitário: todos os componentes de TODOS os pacotes (para listagem) */
export function useAllPackageComponents() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['service-components-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_service_components')
        .select('id, package_id, component_id');
      if (error) throw error;
      return data as { id: string; package_id: string; component_id: string }[];
    },
  });
  return { all: data, isLoading };
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

/** Módulos de pacotes ativos por cliente (customização) */
export function useClientServiceModules(clientId: string | undefined) {
  const qc = useQueryClient();

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['client-service-modules', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('commercial_client_service_modules')
        .select('id, client_id, package_id, component_id, is_active, notes')
        .eq('client_id', clientId);
      if (error) throw error;
      return data as ClientServiceModule[];
    },
    enabled: !!clientId,
  });

  /** Define os módulos ativos de um pacote para o cliente.
   *  activeComponentIds: lista de component_id que devem ficar marcados como ativos. */
  const setPackageModules = useMutation({
    mutationFn: async ({
      packageId,
      allComponentIds,
      activeComponentIds,
    }: {
      packageId: string;
      allComponentIds: string[];
      activeComponentIds: string[];
    }) => {
      if (!clientId) return;
      // Apaga só os módulos daquele pacote para esse cliente, depois re-insere
      const { error: delErr } = await supabase
        .from('commercial_client_service_modules')
        .delete()
        .eq('client_id', clientId)
        .eq('package_id', packageId);
      if (delErr) throw delErr;

      if (allComponentIds.length > 0) {
        const activeSet = new Set(activeComponentIds);
        const rows = allComponentIds.map(cid => ({
          client_id: clientId,
          package_id: packageId,
          component_id: cid,
          is_active: activeSet.has(cid),
        }));
        const { error: insErr } = await supabase
          .from('commercial_client_service_modules')
          .insert(rows as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-service-modules', clientId] });
      toast({ title: 'Módulos do pacote atualizados' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  return { modules, isLoading, setPackageModules };
}
