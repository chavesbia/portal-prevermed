import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export function useASOExames(atendimentoId: string | undefined) {
  return useQuery({
    queryKey: ["aso-exames", atendimentoId],
    enabled: !!atendimentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aso_exames_atendimento")
        .select("*")
        .eq("atendimento_id", atendimentoId!)
        .order("nome_exame");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useASOExameMutations(atendimentoId: string) {
  const qc = useQueryClient();
  const { profile } = useAuth();

  const logHistory = async (campo: string, valorAntigo: string | null, valorNovo: string) => {
    await supabase.from("aso_historico").insert({
      atendimento_id: atendimentoId,
      user_id: profile?.user_id,
      user_name: profile?.full_name,
      acao: "alteracao_exame",
      campo,
      valor_antigo: valorAntigo,
      valor_novo: valorNovo,
    } as any);
  };

  const addExame = useMutation({
    mutationFn: async (params: { nome_exame: string; tipo: "imediato" | "complementar" }) => {
      const { error } = await supabase.from("aso_exames_atendimento").insert({
        atendimento_id: atendimentoId,
        nome_exame: params.nome_exame,
        tipo: params.tipo,
      } as any);
      if (error) throw error;
      await logHistory("exame_adicionado", null, `${params.nome_exame} (${params.tipo})`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aso-exames", atendimentoId] });
      toast({ title: "Exame adicionado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateExame = useMutation({
    mutationFn: async (params: { id: string; field: string; value: any; label?: string }) => {
      const { error } = await supabase
        .from("aso_exames_atendimento")
        .update({ [params.field]: params.value } as any)
        .eq("id", params.id);
      if (error) throw error;
      await logHistory(`exame.${params.field}`, null, String(params.value));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aso-exames", atendimentoId] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteExame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aso_exames_atendimento").delete().eq("id", id);
      if (error) throw error;
      await logHistory("exame_removido", id, "removido");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aso-exames", atendimentoId] });
      toast({ title: "Exame removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { addExame, updateExame, deleteExame };
}

export function useASOHistorico(atendimentoId: string | undefined) {
  return useQuery({
    queryKey: ["aso-historico", atendimentoId],
    enabled: !!atendimentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aso_historico")
        .select("*")
        .eq("atendimento_id", atendimentoId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}
