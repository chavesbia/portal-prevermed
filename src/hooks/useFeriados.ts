import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFeriados() {
  return useQuery({
    queryKey: ["feriados-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feriados").select("data");
      if (error) throw error;
      return (data || []).map((f) => f.data);
    },
    staleTime: 1000 * 60 * 60, // 1h
  });
}
