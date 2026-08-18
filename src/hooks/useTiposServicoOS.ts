import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TipoServicoOS {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useTiposServicoOS() {
  const queryClient = useQueryClient();

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["tipos_servico_os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_servico_os")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as TipoServicoOS[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (tipo: Partial<TipoServicoOS>) => {
      const { data, error } = await supabase
        .from("tipos_servico_os")
        .upsert({
          ...tipo,
          nome: tipo.nome?.toUpperCase(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_os"] });
      toast.success("Tipo de serviço salvo com sucesso");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao salvar tipo de serviço");
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("tipos_servico_os")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_os"] });
      toast.success("Status atualizado");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao atualizar status");
    },
  });

  return {
    tipos,
    isLoading,
    upsert,
    toggleAtivo,
  };
}
