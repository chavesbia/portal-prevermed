import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ServiceItem } from "@/types/pricing";
import { initialServices } from "@/data/services";
import { toast } from "@/hooks/use-toast";

interface DbService {
  id: string;
  code: string;
  description: string;
  unit: string;
  unit_value: number;
  cost_value: number;
  min_quantity: number | null;
  default_markup: number | null;
  category: string;
  is_active: boolean;
  info_text: string | null;
}

const dbToService = (db: DbService): ServiceItem => ({
  id: db.id,
  code: db.code,
  description: db.description,
  unit: db.unit as ServiceItem["unit"],
  unitValue: db.unit_value,
  costValue: db.cost_value,
  minQuantity: db.min_quantity ?? undefined,
  defaultMarkup: db.default_markup ?? undefined,
  category: db.category as ServiceItem["category"],
  infoText: db.info_text ?? undefined,
});

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const serviceToDb = (service: ServiceItem, generateNewId = false): Omit<DbService, "is_active"> => ({
  id: (!isValidUUID(service.id) || generateNewId) ? crypto.randomUUID() : service.id,
  code: service.code,
  description: service.description,
  unit: service.unit,
  unit_value: service.unitValue,
  cost_value: service.costValue,
  min_quantity: service.minQuantity ?? null,
  default_markup: service.defaultMarkup ?? null,
  category: service.category,
  info_text: service.infoText ?? null,
});

export function useServices() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const autoSeedIfEmpty = useCallback(async () => {
    try {
      const { count, error: countError } = await supabase
        .from("services")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;

      if (!count || count === 0) {
        console.log("Populando catálogo de serviços automaticamente...");
        
        const batchSize = 50;
        for (let i = 0; i < initialServices.length; i += batchSize) {
          const batch = initialServices.slice(i, i + batchSize).map(s => serviceToDb(s, true));
          
          const { error } = await supabase.from("services").insert(batch as any);
          if (error && error.code !== "23505") {
            throw error;
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao popular serviços:", error);
      return false;
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      await autoSeedIfEmpty();

      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("description", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setServices(data.map((d: any) => dbToService(d)));
      } else {
        setServices(initialServices);
      }
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
      setServices(initialServices);
    } finally {
      setIsLoading(false);
    }
  }, [autoSeedIfEmpty]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const saveService = async (service: ServiceItem): Promise<boolean> => {
    try {
      const isNew = service.id.startsWith("new-") || !isValidUUID(service.id);
      
      if (isNew) {
        const dbData = serviceToDb(service, true);
        const { error } = await supabase.from("services").insert(dbData as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("services")
          .update({
            code: service.code,
            description: service.description,
            unit: service.unit,
            unit_value: service.unitValue,
            cost_value: service.costValue,
            min_quantity: service.minQuantity ?? null,
            default_markup: service.defaultMarkup ?? null,
            category: service.category,
            info_text: service.infoText ?? null,
          })
          .eq("id", service.id);

        if (error) throw error;
      }

      await fetchServices();
      return true;
    } catch (error: any) {
      console.error("Erro ao salvar serviço:", error);
      toast({ title: "Erro", description: "Erro ao salvar serviço: " + (error.message || "Erro desconhecido"), variant: "destructive" });
      return false;
    }
  };

  const deleteService = async (serviceId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: false })
        .eq("id", serviceId);

      if (error) throw error;

      await fetchServices();
      return true;
    } catch (error: any) {
      console.error("Erro ao remover serviço:", error);
      toast({ title: "Erro", description: "Erro ao remover serviço: " + (error.message || "Erro desconhecido"), variant: "destructive" });
      return false;
    }
  };

  const updateManyServices = async (updatedServices: ServiceItem[]): Promise<boolean> => {
    try {
      const batchSize = 50;
      for (let i = 0; i < updatedServices.length; i += batchSize) {
        const batch = updatedServices.slice(i, i + batchSize);
        
        for (const service of batch) {
          const { error } = await supabase
            .from("services")
            .update({ unit_value: service.unitValue })
            .eq("id", service.id);

          if (error) throw error;
        }
      }

      await fetchServices();
      return true;
    } catch (error: any) {
      console.error("Erro ao atualizar serviços:", error);
      toast({ title: "Erro", description: "Erro ao atualizar serviços: " + (error.message || "Erro desconhecido"), variant: "destructive" });
      return false;
    }
  };

  return {
    services,
    isLoading,
    fetchServices,
    saveService,
    deleteService,
    updateManyServices,
  };
}
