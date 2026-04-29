import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type CatalogArea = "SAUDE" | "SEGURANCA" | "AMBOS";
export type CatalogServiceType = "AVULSO" | "RECORRENTE";

export interface CatalogService {
  id: string;
  name: string;
  category: string;
  area: CatalogArea;
  service_type: CatalogServiceType;
  package_eligible: boolean;
  description: string | null;
  validity_months: number | null;
  delivery_days: number | null;
  reference_value: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertCatalogServiceParams {
  id?: string;
  name: string;
  category: string;
  area: CatalogArea;
  service_type: CatalogServiceType;
  package_eligible: boolean;
  description?: string | null;
  validity_months?: number | null;
  delivery_days?: number | null;
  reference_value?: number | null;
  is_active?: boolean;
}

export const DEFAULT_CATEGORIES = [
  "Laudo",
  "Treinamento",
  "Palestra",
  "Perícia",
  "Consultoria",
  "Pacote",
  "Outro",
];

export const AREA_LABELS: Record<CatalogArea, string> = {
  SAUDE: "Saúde",
  SEGURANCA: "Segurança",
  AMBOS: "Ambos",
};

export const TYPE_LABELS: Record<CatalogServiceType, string> = {
  AVULSO: "Avulso",
  RECORRENTE: "Recorrente",
};

export function useCatalogServices() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["catalog-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_services" as any)
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CatalogService[];
    },
  });

  const categories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...services.map((s) => s.category).filter(Boolean)])
  ).sort();

  const upsert = useMutation({
    mutationFn: async (params: UpsertCatalogServiceParams) => {
      if (!user) throw new Error("Não autenticado");
      const payload = {
        name: params.name.toUpperCase().trim(),
        category: params.category,
        area: params.area,
        service_type: params.service_type,
        package_eligible: params.package_eligible,
        description: params.description ?? null,
        validity_months: params.validity_months ?? null,
        delivery_days: params.delivery_days ?? null,
        reference_value: params.reference_value ?? null,
        is_active: params.is_active ?? true,
      };

      if (params.id) {
        const { error } = await supabase
          .from("catalog_services" as any)
          .update(payload)
          .eq("id", params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("catalog_services" as any)
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Serviço salvo");
      queryClient.invalidateQueries({ queryKey: ["catalog-services"] });
    },
    onError: (e: any) => {
      if (e.code === "23505" || /duplicate|unique/i.test(e.message)) {
        toast.error("Já existe um serviço com esse nome.");
      } else {
        toast.error("Erro ao salvar: " + e.message);
      }
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // soft delete
      const { error } = await supabase
        .from("catalog_services" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço inativado");
      queryClient.invalidateQueries({ queryKey: ["catalog-services"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalog_services" as any)
        .update({ is_active: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço reativado");
      queryClient.invalidateQueries({ queryKey: ["catalog-services"] });
    },
  });

  return {
    services,
    activeServices: services.filter((s) => s.is_active),
    categories,
    isLoading,
    upsert,
    remove,
    restore,
  };
}
