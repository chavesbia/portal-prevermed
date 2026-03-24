import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PrestadorBloqueado = {
  id: string;
  nome: string;
  nome_normalizado: string;
  motivo: string | null;
  created_at: string;
};

export function usePrestadoresBloqueados() {
  const queryClient = useQueryClient();

  const { data: prestadores = [], isLoading } = useQuery({
    queryKey: ["prestadores-bloqueados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestadores_bloqueados" as any)
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PrestadorBloqueado[];
    },
    staleTime: 5 * 60 * 1000, // 5min cache
  });

  const normalizedSet = new Set(
    prestadores.map((p) => p.nome_normalizado)
  );

  function isPrestadorBloqueado(nome: string | null | undefined): boolean {
    if (!nome) return false;
    // Normalize: trim, lowercase, collapse multiple spaces
    const normalized = nome.trim().toLowerCase().replace(/\s+/g, " ");
    return normalizedSet.has(normalized);
  }

  async function adicionarPrestador(nome: string, motivo?: string) {
    const nomeNorm = nome.trim().toLowerCase().replace(/\s+/g, " ");
    const { error } = await supabase.from("prestadores_bloqueados" as any).insert({
      nome: nome.trim(),
      nome_normalizado: nomeNorm,
      motivo: motivo || null,
    } as any);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["prestadores-bloqueados"] });
  }

  async function removerPrestador(id: string) {
    const { error } = await supabase
      .from("prestadores_bloqueados" as any)
      .delete()
      .eq("id", id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["prestadores-bloqueados"] });
  }

  return {
    prestadores,
    isLoading,
    isPrestadorBloqueado,
    adicionarPrestador,
    removerPrestador,
  };
}
