import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcDiasUteis, getSLAStatus } from "@/lib/aso/sla";

export function useASODashboardData() {
  return useQuery({
    queryKey: ["aso-dashboard"],
    queryFn: async () => {
      // Fetch all atendimentos
      const { data: atendimentos, error } = await supabase
        .from("aso_atendimentos")
        .select("*")
        .order("data_atendimento", { ascending: false })
        .limit(1000);
      if (error) throw error;

      // Fetch feriados
      const { data: feriados } = await supabase
        .from("feriados")
        .select("data");
      const feriadoList = (feriados || []).map((f) => f.data);

      const rows = atendimentos || [];
      const now = new Date();

      // --- Stats by status ---
      const byStatus: Record<string, number> = {};
      rows.forEach((r) => {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      });

      // --- Stats by unit ---
      const byUnidade: Record<string, number> = {};
      rows.forEach((r) => {
        const u = r.agenda || "Outros";
        byUnidade[u] = (byUnidade[u] || 0) + 1;
      });

      // --- Stats by tipo prontuario ---
      const byProntuario: Record<string, number> = { digital: 0, fisico: 0, indefinido: 0 };
      rows.forEach((r) => {
        const t = r.tipo_prontuario || "indefinido";
        byProntuario[t] = (byProntuario[t] || 0) + 1;
      });

      // --- SOCNET stats ---
      const socnet = rows.filter((r) => r.base_socnet).length;
      const naoSocnet = rows.length - socnet;

      // --- SLA analysis for active records ---
      const activeStatuses = ["importado", "em_triagem", "aguardando_exames", "pronto_assinatura_medica", "em_escaneamento"];
      const activeRows = rows.filter((r) => activeStatuses.includes(r.status));
      
      let atrasados = 0;
      let atencao = 0;
      let emDia = 0;
      const slaBySetor: Record<string, { total: number; atrasados: number; somasDias: number }> = {};

      activeRows.forEach((r) => {
        const dias = calcDiasUteis(r.data_atendimento, now, feriadoList);
        const sla = getSLAStatus(dias);
        if (sla.status === "atrasado") atrasados++;
        else if (sla.status === "atencao") atencao++;
        else emDia++;

        const setor = r.setor_responsavel || "Sem setor";
        if (!slaBySetor[setor]) slaBySetor[setor] = { total: 0, atrasados: 0, somasDias: 0 };
        slaBySetor[setor].total++;
        slaBySetor[setor].somasDias += dias;
        if (sla.status === "atrasado") slaBySetor[setor].atrasados++;
      });

      // --- Top empresas ---
      const empresaCount: Record<string, number> = {};
      rows.forEach((r) => {
        const e = r.empresa || "Sem empresa";
        empresaCount[e] = (empresaCount[e] || 0) + 1;
      });
      const topEmpresas = Object.entries(empresaCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      // --- Volume by date (last 30 days) ---
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const volumeByDate: Record<string, { lapa: number; osasco: number }> = {};
      rows.forEach((r) => {
        const d = r.data_atendimento;
        if (d >= thirtyDaysAgo.toISOString().slice(0, 10)) {
          if (!volumeByDate[d]) volumeByDate[d] = { lapa: 0, osasco: 0 };
          if (r.agenda?.toLowerCase().includes("osasco")) volumeByDate[d].osasco++;
          else volumeByDate[d].lapa++;
        }
      });
      const volumeChart = Object.entries(volumeByDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, ...v, total: v.lapa + v.osasco }));

      // --- Setor ranking ---
      const setorRanking = Object.entries(slaBySetor)
        .map(([setor, data]) => ({
          setor,
          total: data.total,
          atrasados: data.atrasados,
          mediaDias: data.total > 0 ? Math.round(data.somasDias / data.total * 10) / 10 : 0,
        }))
        .sort((a, b) => b.atrasados - a.atrasados);

      return {
        total: rows.length,
        byStatus,
        byUnidade,
        byProntuario,
        socnet,
        naoSocnet,
        sla: { atrasados, atencao, emDia, total: activeRows.length },
        topEmpresas,
        volumeChart,
        setorRanking,
        activeRows: activeRows.length,
      };
    },
  });
}
