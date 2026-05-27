import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ASOSigningDoctor {
  id: string;
  full_name: string;
  crm: string;
  crm_uf: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useASOSigningDoctors(opts: { onlyActive?: boolean } = {}) {
  const { onlyActive = false } = opts;
  return useQuery({
    queryKey: ["aso-signing-doctors", { onlyActive }],
    queryFn: async () => {
      let q = supabase
        .from("aso_signing_doctors" as any)
        .select("*")
        .order("full_name");
      if (onlyActive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ASOSigningDoctor[];
    },
    staleTime: 60_000,
  });
}

export function useASOSigningDoctorMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["aso-signing-doctors"] });

  const create = useMutation({
    mutationFn: async (
      payload: { full_name: string; crm: string; crm_uf?: string | null }
    ) => {
      const { error } = await supabase
        .from("aso_signing_doctors" as any)
        .insert({
          full_name: payload.full_name.trim().toUpperCase(),
          crm: payload.crm.trim(),
          crm_uf: payload.crm_uf?.trim().toUpperCase() || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Médico cadastrado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async (
      payload: Partial<ASOSigningDoctor> & { id: string }
    ) => {
      const { id, ...rest } = payload;
      const update: any = { ...rest };
      if (rest.full_name) update.full_name = rest.full_name.trim().toUpperCase();
      if (rest.crm_uf !== undefined)
        update.crm_uf = rest.crm_uf?.trim().toUpperCase() || null;
      const { error } = await supabase
        .from("aso_signing_doctors" as any)
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Atualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("aso_signing_doctors" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Removido" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { create, update, remove };
}
