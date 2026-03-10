import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSlaStatus, type SlaStatus } from "@/lib/guias/sla";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, CheckCircle, Clock, FileText, XCircle, Activity } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

type GuiaDash = {
  id: string;
  guia_codigo: string;
  data_guia: string | null;
  data_agendamento: string | null;
  empresa_nome: string | null;
  prestador_nome: string | null;
  tipo_exame: string | null;
  atendido_texto: string | null;
  guia_gestao: { compareceu_status: string; atendimento_lancado: string; aso_anexado: string }[];
};

type ExameDash = { guia_codigo: string; exame_nome: string | null };

const COLORS = {
  EM_DIA: "hsl(142, 71%, 45%)",
  ATENCAO: "hsl(38, 92%, 50%)",
  ATRASADO: "hsl(0, 72%, 51%)",
};

export default function GuiasDashboard() {
  const { data: feriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data } = await supabase.from("feriados").select("data");
      return data?.map((f: any) => f.data) ?? [];
    },
  });

  const { data: guias, isLoading } = useQuery({
    queryKey: ["dashboard-guias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guias")
        .select("id, guia_codigo, data_guia, data_agendamento, empresa_nome, prestador_nome, tipo_exame, atendido_texto, guia_gestao(compareceu_status, atendimento_lancado, aso_anexado)");
      if (error) throw error;
      return data as unknown as GuiaDash[];
    },
  });

  const { data: exames } = useQuery({
    queryKey: ["dashboard-exames"],
    queryFn: async () => {
      const { data, error } = await supabase.from("guia_exames").select("guia_codigo, exame_nome");
      if (error) throw error;
      return data as ExameDash[];
    },
  });

  if (isLoading || !guias) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const guiasWithSla = guias.map((g) => {
    const gestao = g.guia_gestao?.[0];
    const atendLancado = gestao?.atendimento_lancado ?? "NAO_INFORMADO";
    const dataBase = g.data_agendamento ?? g.data_guia;
    const sla = getSlaStatus(dataBase, atendLancado, feriados ?? []);
    return { ...g, sla, gestao };
  });

  const today = startOfDay(new Date());
  const thisWeekStart = subDays(today, 7);
  const thisMonthStart = subDays(today, 30);

  const guiasHoje = guiasWithSla.filter((g) => g.data_guia && startOfDay(new Date(g.data_guia + "T00:00:00")).getTime() === today.getTime()).length;
  const guiasSemana = guiasWithSla.filter((g) => g.data_guia && new Date(g.data_guia + "T00:00:00") >= thisWeekStart).length;
  const guiasMes = guiasWithSla.filter((g) => g.data_guia && new Date(g.data_guia + "T00:00:00") >= thisMonthStart).length;
  const atrasadas = guiasWithSla.filter((g) => g.sla === "ATRASADO").length;
  const emAtencao = guiasWithSla.filter((g) => g.sla === "ATENCAO").length;
  const semAtendimento = guiasWithSla.filter((g) => (g.gestao?.atendimento_lancado ?? "NAO_INFORMADO") !== "SIM").length;
  const asoPendente = guiasWithSla.filter((g) => (g.gestao?.aso_anexado ?? "NAO_INFORMADO") !== "SIM").length;

  const dailyMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(today, i), "yyyy-MM-dd");
    dailyMap.set(d, 0);
  }
  guiasWithSla.forEach((g) => {
    if (g.data_guia && dailyMap.has(g.data_guia)) {
      dailyMap.set(g.data_guia, (dailyMap.get(g.data_guia) ?? 0) + 1);
    }
  });
  const dailyData = Array.from(dailyMap.entries()).map(([date, count]) => ({
    date: format(new Date(date + "T00:00:00"), "dd/MM", { locale: ptBR }),
    guias: count,
  }));

  const prestadorAtrasos = new Map<string, number>();
  guiasWithSla.filter((g) => g.sla === "ATRASADO").forEach((g) => {
    const p = g.prestador_nome || "Sem prestador";
    prestadorAtrasos.set(p, (prestadorAtrasos.get(p) ?? 0) + 1);
  });
  const prestadorData = Array.from(prestadorAtrasos.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 20 ? name.substring(0, 20) + "…" : name, atrasos: count }));

  const empresaMap = new Map<string, number>();
  guiasWithSla.forEach((g) => {
    const e = g.empresa_nome || "Sem empresa";
    empresaMap.set(e, (empresaMap.get(e) ?? 0) + 1);
  });
  const empresaData = Array.from(empresaMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 20 ? name.substring(0, 20) + "…" : name, guias: count }));

  const exameMap = new Map<string, number>();
  exames?.forEach((e) => {
    const name = e.exame_nome || "Sem nome";
    exameMap.set(name, (exameMap.get(name) ?? 0) + 1);
  });
  const exameData = Array.from(exameMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 25 ? name.substring(0, 25) + "…" : name, total: count }));

  const slaCount = { EM_DIA: 0, ATENCAO: 0, ATRASADO: 0 };
  guiasWithSla.forEach((g) => { slaCount[g.sla]++; });
  const slaData = [
    { name: "Em Dia", value: slaCount.EM_DIA, color: COLORS.EM_DIA },
    { name: "Atenção", value: slaCount.ATENCAO, color: COLORS.ATENCAO },
    { name: "Atrasado", value: slaCount.ATRASADO, color: COLORS.ATRASADO },
  ].filter((d) => d.value > 0);

  const cards = [
    { label: "Guias Hoje", value: guiasHoje, icon: FileText, color: "text-primary" },
    { label: "Últimos 7 dias", value: guiasSemana, icon: Activity, color: "text-primary" },
    { label: "Últimos 30 dias", value: guiasMes, icon: FileText, color: "text-primary" },
    { label: "Atrasadas", value: atrasadas, icon: XCircle, color: "text-destructive" },
    { label: "Em Atenção", value: emAtencao, icon: AlertTriangle, color: "text-yellow-500" },
    { label: "Sem Atendimento", value: semAtendimento, icon: Clock, color: "text-muted-foreground" },
    { label: "ASO Pendente", value: asoPendente, icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard de Guias</h1>
        <p className="text-muted-foreground">Visão geral — {guias.length} guias no total</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-2xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Guias por Dia (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="guias" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição de SLA</CardTitle>
          </CardHeader>
          <CardContent>
            {slaData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={slaData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {slaData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Atrasos por Prestador</CardTitle>
          </CardHeader>
          <CardContent>
            {prestadorData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem atrasos 🎉</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={prestadorData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="atrasos" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Volume por Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            {empresaData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={empresaData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="guias" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Exames Mais Frequentes</CardTitle>
        </CardHeader>
        <CardContent>
          {exameData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados de exames</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={exameData} margin={{ bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} height={70} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
