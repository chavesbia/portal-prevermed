import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PassivoStatus } from '@/lib/passivos/utils';

export interface Passivo {
  id: string;
  cnpj: string;
  empresa_nome: string;
  numero_acordo: string;
  tipo_parcelamento: string;
  parcelas_pagas: number;
  parcelas_totais: number;
  parcelas_restantes: number;
  valor_mensal: number;
  dia_vencimento: number | null;
  status: PassivoStatus;
  parcelas_em_atraso: number;
  observacoes: string | null;
  link_acesso: string | null;
  pagamento_baixado: boolean;
  guia_recebida: boolean;
  guia_conferida: boolean;
  link_segunda_via: string | null;
  last_updated_by: string | null;
  last_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function usePassivos() {
  return useQuery({
    queryKey: ['passivos'],
    queryFn: async (): Promise<Passivo[]> => {
      const { data, error } = await supabase
        .from('passivos_parcelamentos')
        .select('*')
        .order('empresa_nome', { ascending: true })
        .order('numero_acordo', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Passivo[];
    },
  });
}

export function useUpsertPassivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Passivo> & { id?: string }) => {
      const payload: any = {
        cnpj: input.cnpj,
        empresa_nome: input.empresa_nome,
        numero_acordo: input.numero_acordo,
        tipo_parcelamento: input.tipo_parcelamento,
        parcelas_pagas: input.parcelas_pagas ?? 0,
        parcelas_totais: input.parcelas_totais ?? 1,
        valor_mensal: input.valor_mensal ?? 0,
        dia_vencimento: input.dia_vencimento ?? null,
        status: input.status ?? 'em_dia',
        parcelas_em_atraso: input.parcelas_em_atraso ?? 0,
        observacoes: input.observacoes ?? null,
        link_acesso: input.link_acesso ?? null,
        link_segunda_via: input.link_segunda_via ?? null,
      };
      if (input.id) {
        const { error } = await supabase
          .from('passivos_parcelamentos')
          .update(payload)
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('passivos_parcelamentos')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['passivos'] }),
  });
}

export function useUpdatePassivoFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Passivo> }) => {
      const { error } = await supabase
        .from('passivos_parcelamentos')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['passivos'] }),
  });
}

export function useDeletePassivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('passivos_parcelamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['passivos'] }),
  });
}
