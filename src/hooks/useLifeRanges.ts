import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LifeRange {
  id: string;
  label: string;
  min_lives: number;
  max_lives: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertLifeRange {
  id?: string;
  label: string;
  min_lives: number;
  max_lives: number | null;
  is_active?: boolean;
}

export function useLifeRanges() {
  const qc = useQueryClient();

  const { data: ranges = [], isLoading } = useQuery({
    queryKey: ["life-ranges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("life_ranges" as any)
        .select("*")
        .order("min_lives", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as LifeRange[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: UpsertLifeRange) => {
      const payload = {
        label: p.label.trim(),
        min_lives: p.min_lives,
        max_lives: p.max_lives,
        is_active: p.is_active ?? true,
      };
      if (p.id) {
        const { error } = await supabase
          .from("life_ranges" as any)
          .update(payload)
          .eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("life_ranges" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Faixa salva");
      qc.invalidateQueries({ queryKey: ["life-ranges"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("life_ranges" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Faixa inativada");
      qc.invalidateQueries({ queryKey: ["life-ranges"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return {
    ranges,
    activeRanges: ranges.filter((r) => r.is_active),
    isLoading,
    upsert,
    remove,
  };
}
