import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CatalogItem {
  id: string;
  nome: string;
  is_active: boolean;
  crm?: string | null;
}

export function useRetificacaoAreas(includeInactive = false) {
  return useQuery({
    queryKey: ['retificacao-areas', includeInactive],
    queryFn: async () => {
      let q = supabase.from('aso_retificacao_areas').select('*').order('nome');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CatalogItem[];
    },
  });
}

export function useRetificacaoMotivos(includeInactive = false) {
  return useQuery({
    queryKey: ['retificacao-motivos', includeInactive],
    queryFn: async () => {
      let q = supabase.from('aso_retificacao_motivos').select('*').order('nome');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CatalogItem[];
    },
  });
}

export function useRetificacaoMedicos(includeInactive = false) {
  return useQuery({
    queryKey: ['retificacao-medicos', includeInactive],
    queryFn: async () => {
      let q = supabase.from('aso_retificacao_medicos_examinadores').select('*').order('nome');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CatalogItem[];
    },
  });
}
