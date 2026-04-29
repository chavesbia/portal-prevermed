import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PackageItemType = "NOVO" | "RENOVACAO" | "AMBOS";

export interface PackageItem {
  id: string;
  package_id: string;
  service_id: string;
  quantity: number;
  unit_value: number | null;
  item_type: PackageItemType;
  created_at: string;
}

export interface UpsertPackageItemParams {
  id?: string;
  package_id: string;
  service_id: string;
  quantity: number;
  unit_value: number | null;
  item_type: PackageItemType;
}

export const ITEM_TYPE_LABELS: Record<PackageItemType, string> = {
  NOVO: "Novo",
  RENOVACAO: "Renovação",
  AMBOS: "Ambos",
};

export function useServicePackageItems(packageId: string | null) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalog-service-packages", packageId],
    enabled: !!packageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_service_packages" as any)
        .select("*")
        .eq("package_id", packageId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PackageItem[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["catalog-service-packages", packageId] });

  const upsert = useMutation({
    mutationFn: async (params: UpsertPackageItemParams) => {
      if (params.package_id === params.service_id) {
        throw new Error("O pacote não pode incluir ele mesmo.");
      }
      const payload = {
        package_id: params.package_id,
        service_id: params.service_id,
        quantity: params.quantity,
        unit_value: params.unit_value,
        item_type: params.item_type,
      };
      if (params.id) {
        const { error } = await supabase
          .from("catalog_service_packages" as any)
          .update(payload)
          .eq("id", params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("catalog_service_packages" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Item salvo no pacote");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalog_service_packages" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return { items, isLoading, upsert, remove };
}
