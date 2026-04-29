import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type BillingModel = "AVULSO" | "PACOTE_VIDAS" | "POR_ASO";

export const BILLING_LABELS: Record<BillingModel, string> = {
  AVULSO: "Avulso",
  PACOTE_VIDAS: "Pacote por Vidas",
  POR_ASO: "Por ASO",
};

export interface PricingPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_model: BillingModel;
  display_order: number;
  is_active: boolean;
  is_recommended: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertPlan {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  billing_model: BillingModel;
  display_order?: number;
  is_active?: boolean;
  is_recommended?: boolean;
}

export interface PlanServicePrice {
  id: string;
  plan_id: string;
  catalog_service_id: string;
  life_range_id: string | null;
  price: number;
  is_included_in_package: boolean;
  notes: string | null;
}

export interface UpsertPrice {
  id?: string;
  plan_id: string;
  catalog_service_id: string;
  life_range_id: string | null;
  price: number;
  is_included_in_package: boolean;
  notes?: string | null;
}

export function usePricingPlans() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["pricing-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_plans" as any)
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PricingPlan[];
    },
  });

  const upsertPlan = useMutation({
    mutationFn: async (p: UpsertPlan) => {
      const payload = {
        code: p.code.trim().toUpperCase(),
        name: p.name.trim(),
        description: p.description ?? null,
        billing_model: p.billing_model,
        display_order: p.display_order ?? 0,
        is_active: p.is_active ?? true,
        is_recommended: p.is_recommended ?? false,
      };
      if (p.id) {
        const { error } = await supabase
          .from("pricing_plans" as any)
          .update(payload)
          .eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pricing_plans" as any)
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Plano salvo");
      qc.invalidateQueries({ queryKey: ["pricing-plans"] });
    },
    onError: (e: any) => {
      if (e.code === "23505") toast.error("Código de plano já existe.");
      else toast.error("Erro: " + e.message);
    },
  });

  const removePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pricing_plans" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano inativado");
      qc.invalidateQueries({ queryKey: ["pricing-plans"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return {
    plans,
    activePlans: plans.filter((p) => p.is_active),
    isLoading,
    upsertPlan,
    removePlan,
  };
}

export function usePlanServicePrices(planId?: string) {
  const qc = useQueryClient();

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["plan-service-prices", planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_service_prices" as any)
        .select("*")
        .eq("plan_id", planId!);
      if (error) throw error;
      return (data || []) as unknown as PlanServicePrice[];
    },
  });

  const upsertPrice = useMutation({
    mutationFn: async (p: UpsertPrice) => {
      const payload = {
        plan_id: p.plan_id,
        catalog_service_id: p.catalog_service_id,
        life_range_id: p.life_range_id,
        price: p.price,
        is_included_in_package: p.is_included_in_package,
        notes: p.notes ?? null,
      };
      // upsert by unique key
      const { error } = await supabase
        .from("plan_service_prices" as any)
        .upsert(payload, {
          onConflict: "plan_id,catalog_service_id,life_range_id",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-service-prices", planId] });
    },
    onError: (e: any) => toast.error("Erro ao salvar preço: " + e.message),
  });

  const removePrice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plan_service_prices" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-service-prices", planId] });
    },
  });

  return { prices, isLoading, upsertPrice, removePrice };
}
