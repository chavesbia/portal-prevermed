import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AcrescimoFuncaoSolicitacao {
  id: string;
  company_id: string;
  unidade_id: string | null;
  solicitante_nome: string;
  data_solicitacao_cliente: string;
  observacao: string | null;
  realizado: boolean;
  realizado_por: string | null;
  realizado_em: string | null;
  valor_total_calculado: number | null;
  created_at: string;
  created_by: string | null;
  // Joined
  company_name?: string;
  unidade_nome?: string;
  realizado_por_nome?: string;
  cargos?: AcrescimoFuncaoCargo[];
}

export interface AcrescimoFuncaoCargo {
  id: string;
  solicitacao_id: string;
  setor: string;
  cargo: string;
}

export function useAcrescimoFuncao() {
  const qc = useQueryClient();

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["acrescimos-funcao-solicitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acrescimos_funcao_solicitacoes")
        .select(`
          *,
          companies (name),
          company_units (name),
          profissionais (nome),
          acrescimos_funcao_cargos (*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        ...s,
        company_name: s.companies?.name,
        unidade_nome: s.company_units?.name,
        realizado_por_nome: s.profissionais?.nome,
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

  const markAsRealizado = useMutation({
    mutationFn: async ({ id, realizado_por, company_id, num_cargos }: { id: string; realizado_por: string; company_id: string; num_cargos: number }) => {
      // 1. Buscar preço do serviço 000000062 para esta empresa
      const { data: pricingData, error: pricingError } = await supabase
        .from("company_pricing_items")
        .select("valor_produto_pontual")
        .eq("company_id", company_id)
        .eq("soc_product_code", "000000062")
        .maybeSingle();

      if (pricingError) {
        console.error("Erro ao buscar preço:", pricingError);
      }

      let valorCalculado = null;
      if (pricingData?.valor_produto_pontual) {
        valorCalculado = pricingData.valor_produto_pontual * num_cargos;
      } else {
        toast.warning("Preço do serviço 000000062 não encontrado para esta empresa — valor não calculado, revisar manualmente.");
      }

      const { error: updateError } = await supabase
        .from("acrescimos_funcao_solicitacoes")
        .update({
          realizado: true,
          realizado_por,
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

  return { solicitacoes, isLoading, createSolicitacao, markAsRealizado };
}
