import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export type FiltroTipoProntuario = "fisico" | "digital" | "ambos";

export interface FechamentoFilters {
  periodo_inicial: string; // YYYY-MM-DD
  periodo_final: string;   // YYYY-MM-DD
  tipo_prontuario: FiltroTipoProntuario;
}

/** Busca prontuários elegíveis (status faturamento + período + tipo). */
export function useElegiveisFechamento(filters: FechamentoFilters | null) {
  return useQuery({
    queryKey: ["aso-elegiveis-fechamento", filters],
    enabled: !!filters,
    queryFn: async () => {
      if (!filters) return [];
      let q = supabase
        .from("aso_atendimentos")
        .select("*")
        .eq("status", "liberado_faturamento")
        .gte("data_atendimento", filters.periodo_inicial)
        .lte("data_atendimento", filters.periodo_final)
        .order("empresa", { ascending: true })
        .order("data_atendimento", { ascending: true });

      if (filters.tipo_prontuario !== "ambos") {
        q = q.eq("tipo_prontuario", filters.tipo_prontuario as any);
      }
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return data || [];
    },
  });
}

/** Lista todos os lotes de fechamento. */
export function useFechamentoLotes() {
  return useQuery({
    queryKey: ["aso-fechamento-lotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aso_fechamento_lotes" as any)
        .select("*")
        .order("fechado_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

/** Itens (prontuários) de um lote específico. */
export function useFechamentoItens(loteId: string | null) {
  return useQuery({
    queryKey: ["aso-fechamento-itens", loteId],
    enabled: !!loteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aso_fechamento_itens" as any)
        .select("*")
        .eq("lote_id", loteId!)
        .order("empresa", { ascending: true })
        .order("funcionario", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

async function gerarNumeroLote(): Promise<string> {
  const ano = new Date().getFullYear();
  const { count } = await supabase
    .from("aso_fechamento_lotes" as any)
    .select("id", { count: "exact", head: true })
    .gte("fechado_em", `${ano}-01-01`)
    .lte("fechado_em", `${ano}-12-31`);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `FECH-${ano}-${seq}`;
}

/** Cria lote e marca prontuários como 'fechado'. */
export function useCriarFechamento() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      filtros: FechamentoFilters;
      atendimentos: any[];
      observacoes?: string;
    }) => {
      const { filtros, atendimentos, observacoes } = params;
      if (atendimentos.length === 0) {
        throw new Error("Nenhum prontuário elegível para fechar.");
      }
      const numero_lote = await gerarNumeroLote();

      // 1) cria lote
      const { data: loteData, error: loteErr } = await supabase
        .from("aso_fechamento_lotes" as any)
        .insert({
          numero_lote,
          periodo_inicial: filtros.periodo_inicial,
          periodo_final: filtros.periodo_final,
          filtro_tipo_prontuario: filtros.tipo_prontuario,
          total_prontuarios: atendimentos.length,
          observacoes: observacoes ?? null,
          fechado_por: profile?.user_id,
          fechado_por_nome: profile?.full_name ?? null,
        } as any)
        .select()
        .single();
      if (loteErr) throw loteErr;
      const lote = loteData as any;

      // 2) cria itens (snapshot)
      const itens = atendimentos.map((a) => ({
        lote_id: lote.id,
        atendimento_id: a.id,
        empresa: a.empresa,
        funcionario: a.funcionario,
        cpf: a.cpf,
        data_atendimento: a.data_atendimento,
        unidade: a.unidade,
        setor: a.setor,
        cargo: a.cargo,
        tipo_prontuario: a.tipo_prontuario,
      }));
      const { error: itemErr } = await supabase
        .from("aso_fechamento_itens" as any)
        .insert(itens as any);
      if (itemErr) throw itemErr;

      // 3) atualiza atendimentos: status 'fechado' + ref do lote
      const ids = atendimentos.map((a) => a.id);
      const { error: updErr } = await supabase
        .from("aso_atendimentos")
        .update({ status: "fechado" as any, fechamento_lote_id: lote.id } as any)
        .in("id", ids);
      if (updErr) throw updErr;

      return lote;
    },
    onSuccess: (lote) => {
      qc.invalidateQueries({ queryKey: ["aso-fechamento-lotes"] });
      qc.invalidateQueries({ queryKey: ["aso-elegiveis-fechamento"] });
      qc.invalidateQueries({ queryKey: ["aso-atendimentos"] });
      qc.invalidateQueries({ queryKey: ["aso-stats"] });
      toast({ title: "Fechamento gerado", description: `Lote ${lote.numero_lote} criado com sucesso.` });
    },
    onError: (e: any) => toast({ title: "Erro ao fechar lote", description: e.message, variant: "destructive" }),
  });
}

/** Exclui lote (ADM Master): devolve prontuários para 'liberado_faturamento'. */
export function useExcluirFechamento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (loteId: string) => {
      // 1) IDs dos atendimentos do lote
      const { data: itens, error: e1 } = await supabase
        .from("aso_fechamento_itens" as any)
        .select("atendimento_id")
        .eq("lote_id", loteId);
      if (e1) throw e1;
      const ids = (itens || []).map((i: any) => i.atendimento_id);

      // 2) devolve atendimentos para faturamento
      if (ids.length > 0) {
        const { error: e2 } = await supabase
          .from("aso_atendimentos")
          .update({ status: "liberado_faturamento" as any, fechamento_lote_id: null } as any)
          .in("id", ids);
        if (e2) throw e2;
      }

      // 3) deleta lote (cascade apaga itens)
      const { error: e3 } = await supabase
        .from("aso_fechamento_lotes" as any)
        .delete()
        .eq("id", loteId);
      if (e3) throw e3;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aso-fechamento-lotes"] });
      qc.invalidateQueries({ queryKey: ["aso-fechamento-itens"] });
      qc.invalidateQueries({ queryKey: ["aso-atendimentos"] });
      qc.invalidateQueries({ queryKey: ["aso-stats"] });
      toast({ title: "Lote excluído", description: "Prontuários devolvidos ao status Faturamento." });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir lote", description: e.message, variant: "destructive" }),
  });
}
