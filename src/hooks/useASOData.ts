import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ASOFilters {
  status?: string;
  agenda?: string;
  empresa?: string;
  data_de?: string;
  data_ate?: string;
  medico?: string;
  tipo_prontuario?: string;
  base_socnet?: boolean | null;
  search?: string;
}

export function useASOAtendimentos(filters: ASOFilters = {}) {
  return useQuery({
    queryKey: ["aso-atendimentos", filters],
    queryFn: async () => {
      let q = supabase
        .from("aso_atendimentos")
        .select("*")
        .order("data_atendimento", { ascending: false })
        .order("hora_inicial", { ascending: true });

      if (filters.status) q = q.eq("status", filters.status as any);
      if (filters.agenda) q = q.ilike("agenda", `%${filters.agenda}%`);
      if (filters.empresa) q = q.ilike("empresa", `%${filters.empresa}%`);
      if (filters.data_de) q = q.gte("data_atendimento", filters.data_de);
      if (filters.data_ate) q = q.lte("data_atendimento", filters.data_ate);
      if (filters.medico) q = q.ilike("medico", `%${filters.medico}%`);
      if (filters.tipo_prontuario) q = q.eq("tipo_prontuario", filters.tipo_prontuario as any);
      if (filters.base_socnet === true) q = q.eq("base_socnet", true);
      if (filters.base_socnet === false) q = q.eq("base_socnet", false);
      if (filters.search) {
        q = q.or(`funcionario.ilike.%${filters.search}%,cpf.ilike.%${filters.search}%,empresa.ilike.%${filters.search}%,id_interno.ilike.%${filters.search}%`);
      }

      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useASOLotes() {
  return useQuery({
    queryKey: ["aso-lotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aso_lotes_importacao")
        .select("*")
        .order("importado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useASOStats() {
  return useQuery({
    queryKey: ["aso-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aso_atendimentos")
        .select("status, agenda, unidade, id_interno");
      if (error) throw error;

      const stats = {
        total: data?.length ?? 0,
        importado: 0,
        em_triagem: 0,
        aguardando_exames: 0,
        pronto_assinatura_medica: 0,
        em_escaneamento: 0,
        liberado: 0,
        liberado_faturamento: 0,
        finalizado: 0,
        lapa: 0,
        osasco: 0,
      };

      for (const row of data || []) {
        const s = row.status as keyof typeof stats;
        if (s in stats) (stats as any)[s]++;
        if (row.agenda?.toLowerCase().includes("lapa")) stats.lapa++;
        else if (row.agenda?.toLowerCase().includes("osasco")) stats.osasco++;
      }
      return stats;
    },
  });
}
