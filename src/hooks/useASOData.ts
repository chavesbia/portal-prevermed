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

const STATUS_LIST = [
  "importado", "em_triagem", "aguardando_exames", "pronto_assinatura_medica",
  "em_escaneamento", "liberado", "liberado_faturamento", "finalizado",
] as const;

const hasOsasco = "agenda.ilike.%osasco%,unidade.ilike.%osasco%,id_interno.ilike.%osasco%";
const hasLapa = "agenda.ilike.%lapa%,unidade.ilike.%lapa%,id_interno.ilike.%lapa%";

/**
 * Contadores dos cards: o banco devolve só os números (sem baixar linhas),
 * o que também evita o teto de 1.000 registros por consulta.
 */
export function useASOStats() {
  return useQuery({
    queryKey: ["aso-stats"],
    queryFn: async () => {
      const count = async (build: (q: any) => any) => {
        const { count, error } = await build(
          supabase.from("aso_atendimentos").select("id", { count: "exact", head: true })
        );
        if (error) throw error;
        return count ?? 0;
      };
      const [total, osasco, lapaAll, lapaOsasco, ...porStatus] = await Promise.all([
        count((q) => q),
        count((q) => q.or(hasOsasco)),
        count((q) => q.or(hasLapa)),
        count((q) => q.or(hasLapa).or(hasOsasco)),
        ...STATUS_LIST.map((st) => count((q) => q.eq("status", st))),
      ]);
      const stats: Record<string, number> = { total, osasco, lapa: lapaAll - lapaOsasco };
      STATUS_LIST.forEach((st, i) => (stats[st] = porStatus[i]));
      return stats as {
        total: number; importado: number; em_triagem: number; aguardando_exames: number;
        pronto_assinatura_medica: number; em_escaneamento: number; liberado: number;
        liberado_faturamento: number; finalizado: number; lapa: number; osasco: number;
      };
    },
  });
}
