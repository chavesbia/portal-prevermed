import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type RenewalIndexType = "IGPM" | "IPCA" | "OUTRO";
export type RenewalStatus = "aguardando_aprovacao" | "aprovado" | "rejeitado";
export type DeviationStatus = "acima" | "igual" | "abaixo";

export interface RenewalItem {
  id?: string;
  service_id?: string | null;
  service_name: string;
  current_value: number;
  applied_percent: number;
  adjusted_value: number;
  reference_value: number;
  is_included?: boolean;
  observation?: string | null;
  sort_order?: number;
}

export interface RenewalQuotation {
  id: string;
  renewal_number: string | null;
  version_number: number;
  client_id: string | null;
  client_name: string;
  current_lives: number;
  index_type: string;
  index_percent: number;
  reference_period: string | null;
  current_total_monthly: number;
  current_total_annual: number;
  adjusted_total_monthly: number;
  adjusted_total_annual: number;
  reference_total_monthly: number;
  deviation_percent: number;
  deviation_status: string;
  justification: string | null;
  notes: string | null;
  status: RenewalStatus;
  rejection_reason: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  items?: RenewalItem[];
  creator_name?: string;
  approver_name?: string;
}

export interface SaveRenewalParams {
  client_id?: string | null;
  client_name: string;
  current_lives: number;
  index_type: RenewalIndexType;
  index_percent: number;
  reference_period?: string;
  items: RenewalItem[];
  reference_total_monthly: number;
  justification?: string;
  notes?: string;
}

function totalsFromItems(items: RenewalItem[]) {
  const current_total_monthly = items.reduce(
    (acc, i) => acc + (i.is_included !== false ? i.current_value : 0),
    0
  );
  const adjusted_total_monthly = items.reduce(
    (acc, i) => acc + (i.is_included !== false ? i.adjusted_value : 0),
    0
  );
  return {
    current_total_monthly,
    current_total_annual: current_total_monthly * 12,
    adjusted_total_monthly,
    adjusted_total_annual: adjusted_total_monthly * 12,
  };
}

function deviation(adjusted: number, reference: number) {
  if (!reference || reference === 0) return { deviation_percent: 0, deviation_status: "igual" as DeviationStatus };
  const dev = ((adjusted - reference) / reference) * 100;
  let status: DeviationStatus = "igual";
  if (dev > 1) status = "acima";
  else if (dev < -1) status = "abaixo";
  return { deviation_percent: Number(dev.toFixed(2)), deviation_status: status };
}

export function useRenewalQuotations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: renewals = [], isLoading } = useQuery({
    queryKey: ["renewal-quotations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("renewal_quotations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const withProfiles = await Promise.all(
        (data || []).map(async (r: any) => {
          const { data: creator } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", r.created_by)
            .maybeSingle();
          let approver = null;
          if (r.approved_by) {
            const { data: a } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", r.approved_by)
              .maybeSingle();
            approver = a;
          }
          return {
            ...r,
            creator_name: creator?.full_name,
            approver_name: approver?.full_name,
          } as RenewalQuotation;
        })
      );
      return withProfiles;
    },
  });

  const fetchItems = async (renewal_id: string): Promise<RenewalItem[]> => {
    const { data, error } = await supabase
      .from("renewal_quotation_items")
      .select("*")
      .eq("renewal_id", renewal_id)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data || []) as any;
  };

  const saveRenewal = useMutation({
    mutationFn: async (params: SaveRenewalParams) => {
      if (!user) throw new Error("Não autenticado");
      const totals = totalsFromItems(params.items);
      const dev = deviation(totals.adjusted_total_monthly, params.reference_total_monthly);

      const { data: created, error } = await supabase
        .from("renewal_quotations")
        .insert({
          client_id: params.client_id ?? null,
          client_name: params.client_name,
          current_lives: params.current_lives,
          index_type: params.index_type,
          index_percent: params.index_percent,
          reference_period: params.reference_period ?? null,
          reference_total_monthly: params.reference_total_monthly,
          ...totals,
          ...dev,
          justification: params.justification ?? null,
          notes: params.notes ?? null,
          status: "aguardando_aprovacao",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (params.items.length > 0) {
        const rows = params.items.map((it, idx) => ({
          renewal_id: created.id,
          service_id: it.service_id ?? null,
          service_name: it.service_name,
          current_value: it.current_value,
          applied_percent: it.applied_percent,
          adjusted_value: it.adjusted_value,
          reference_value: it.reference_value,
          is_included: it.is_included !== false,
          observation: it.observation ?? null,
          sort_order: idx,
        }));
        const { error: itErr } = await supabase.from("renewal_quotation_items").insert(rows);
        if (itErr) throw itErr;
      }
      return created.id;
    },
    onSuccess: () => {
      toast.success("Renovação salva! Aguardando aprovação.");
      queryClient.invalidateQueries({ queryKey: ["renewal-quotations"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar renovação: " + e.message),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("renewal_quotations")
        .update({
          status: "aprovado",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Renovação aprovada");
      queryClient.invalidateQueries({ queryKey: ["renewal-quotations"] });
    },
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("renewal_quotations")
        .update({
          status: "rejeitado",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Renovação rejeitada");
      queryClient.invalidateQueries({ queryKey: ["renewal-quotations"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("renewal_quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Renovação excluída");
      queryClient.invalidateQueries({ queryKey: ["renewal-quotations"] });
    },
  });

  return {
    renewals,
    isLoading,
    fetchItems,
    saveRenewal,
    approve,
    reject,
    remove,
  };
}

export { totalsFromItems, deviation };
