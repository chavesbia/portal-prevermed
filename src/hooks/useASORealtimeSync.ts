import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém as queries do módulo Liberação de ASOs sincronizadas em tempo real
 * via Supabase Realtime. Monte este hook UMA vez por página/seção (ex.: na
 * página LiberacaoASOs). Ele escuta mudanças em aso_atendimentos,
 * aso_exames_atendimento e aso_historico e invalida as queries relevantes.
 */
export function useASORealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("aso-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aso_atendimentos" },
        () => {
          qc.invalidateQueries({ queryKey: ["aso-atendimentos"] });
          qc.invalidateQueries({ queryKey: ["aso-stats"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aso_exames_atendimento" },
        (payload: any) => {
          const atendId =
            payload?.new?.atendimento_id || payload?.old?.atendimento_id;
          if (atendId) {
            qc.invalidateQueries({ queryKey: ["aso-exames", atendId] });
          } else {
            qc.invalidateQueries({ queryKey: ["aso-exames"] });
          }
          qc.invalidateQueries({ queryKey: ["aso-novas-coletas"] });
          qc.invalidateQueries({ queryKey: ["aso-atendimentos"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aso_historico" },
        (payload: any) => {
          const atendId =
            payload?.new?.atendimento_id || payload?.old?.atendimento_id;
          if (atendId) {
            qc.invalidateQueries({ queryKey: ["aso-historico", atendId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
