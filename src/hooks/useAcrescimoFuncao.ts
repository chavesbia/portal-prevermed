import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AcrescimoFuncaoSolicitacao, AcrescimoFuncaoCargo } from "@/types/os";

export function useAcrescimoFuncao() {
  const qc = useQueryClient();

  const { data: solicitacoes = [], isLoading, error } = useQuery({
    queryKey: ["acrescimos-funcao-solicitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acrescimos_funcao_solicitacoes")
        .select(`
          *,
          companies (razao_social),
          company_units (name),
          profissionais (nome),
          acrescimos_funcao_cargos (*)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro na busca de solicitações:", error);
        throw error;
      }

      return (data || []).map((s: any) => ({
        ...s,
        company_name: s.companies?.razao_social,
        unidade_nome: s.company_units?.name,
        realizado_por_nome: s.realizado_por_nome || s.profissionais?.nome,
        cargos: s.acrescimos_funcao_cargos,
      })) as AcrescimoFuncaoSolicitacao[];
    },
  });

  const createSolicitacao = useMutation({
    mutationFn: async (payload: {
      solicitacao: Omit<AcrescimoFuncaoSolicitacao, "id" | "created_at" | "created_by" | "realizado" | "realizado_por" | "realizado_em" | "valor_total_calculado">;
      cargos: Omit<AcrescimoFuncaoCargo, "id" | "solicitacao_id">[];
    }) => {
      const { data: solicitacaoData, error: solicitacaoError } = await supabase
        .from("acrescimos_funcao_solicitacoes")
        .insert(payload.solicitacao)
        .select()
        .single();

      if (solicitacaoError) throw solicitacaoError;

      if (payload.cargos.length > 0) {
        const cargosPayload = payload.cargos.map(c => ({
          ...c,
          solicitacao_id: solicitacaoData.id,
        }));
        const { error: cargosError } = await supabase
          .from("acrescimos_funcao_cargos")
          .insert(cargosPayload);

        if (cargosError) throw cargosError;
      }

      return solicitacaoData;
    },
    onSuccess: () => {
      toast.success("Solicitação criada com sucesso");
      qc.invalidateQueries({ queryKey: ["acrescimos-funcao-solicitacoes"] });
    },
    onError: (e: any) => toast.error("Erro ao criar solicitação: " + e.message),
  });

  const updateSolicitacao = useMutation({
    mutationFn: async (payload: {
      id: string;
      solicitacao: Partial<Omit<AcrescimoFuncaoSolicitacao, "id" | "cargos">>;
      cargos: Omit<AcrescimoFuncaoCargo, "id" | "solicitacao_id">[];
    }) => {
      const { error: solicitacaoError } = await supabase
        .from("acrescimos_funcao_solicitacoes")
        .update(payload.solicitacao)
        .eq("id", payload.id);

      if (solicitacaoError) throw solicitacaoError;

      // Simplificado: remove cargos antigos e insere novos
      const { error: deleteError } = await supabase
        .from("acrescimos_funcao_cargos")
        .delete()
        .eq("solicitacao_id", payload.id);
      
      if (deleteError) throw deleteError;

      if (payload.cargos.length > 0) {
        const cargosPayload = payload.cargos.map(c => ({
          ...c,
          solicitacao_id: payload.id,
        }));
        const { error: cargosError } = await supabase
          .from("acrescimos_funcao_cargos")
          .insert(cargosPayload);

        if (cargosError) throw cargosError;
      }
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada com sucesso");
      qc.invalidateQueries({ queryKey: ["acrescimos-funcao-solicitacoes"] });
    },
    onError: (e: any) => toast.error("Erro ao atualizar solicitação: " + e.message),
  });

  const deleteSolicitacao = useMutation({
    mutationFn: async (id: string) => {
      // Remove os cargos vinculados antes (evita bloqueio por FK)
      const { error: cargosError } = await supabase
        .from("acrescimos_funcao_cargos")
        .delete()
        .eq("solicitacao_id", id);
      if (cargosError) throw cargosError;

      const { data, error } = await supabase
        .from("acrescimos_funcao_solicitacoes")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nenhum registro foi excluído — você não tem permissão para excluir esta solicitação.");
      }
      return id;
    },
    onSuccess: (id) => {
      toast.success("Solicitação excluída com sucesso");
      qc.setQueryData(["acrescimos-funcao-solicitacoes"], (old: any) =>
        Array.isArray(old) ? old.filter((s: any) => s.id !== id) : old
      );
      qc.invalidateQueries({ queryKey: ["acrescimos-funcao-solicitacoes"] });
    },
    onError: (e: any) => toast.error("Erro ao excluir solicitação: " + e.message),
  });

  const markAsRealizado = useMutation({
    mutationFn: async ({ id, company_id, num_cargos }: { id: string; company_id: string; num_cargos: number }) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      let nomeUsuario = authData.user?.email || "Usuário";
      if (userId) {
        const { data: perfil } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .maybeSingle();
        if (perfil?.full_name) nomeUsuario = perfil.full_name;
      }

      // 1. Buscar preço do serviço 000000062 para esta empresa
      const { data: pricingData, error: pricingError } = await supabase
        .from("company_pricing_items")
        .select("valor_produto_pontual")
        .eq("company_id", company_id)
        .or(`soc_product_code.eq.62,soc_product_code.eq.000000062`)
        .maybeSingle();

      if (pricingError) {
        console.error("Erro ao buscar preço:", pricingError);
      }

      let valorCalculado = null;
      if (pricingData?.valor_produto_pontual) {
        valorCalculado = pricingData.valor_produto_pontual * num_cargos;
      } else {
        toast.warning("Preço do serviço 'Acréscimo de Função' (código 62/000000062) não encontrado para esta empresa — valor não calculado.");
      }

      const { error: updateError } = await supabase
        .from("acrescimos_funcao_solicitacoes")
        .update({
          realizado: true,
          realizado_por_user_id: userId,
          realizado_por_nome: nomeUsuario,
          realizado_em: new Date().toISOString(),
          valor_total_calculado: valorCalculado,
        })
        .eq("id", id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Solicitação marcada como realizada");
      qc.invalidateQueries({ queryKey: ["acrescimos-funcao-solicitacoes"] });
    },
    onError: (e: any) => toast.error("Erro ao atualizar solicitação: " + e.message),
  });

  return { 
    solicitacoes, 
    isLoading, 
    error, 
    createSolicitacao, 
    updateSolicitacao,
    deleteSolicitacao,
    markAsRealizado 
  };
}
