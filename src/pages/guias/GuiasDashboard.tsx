import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { getSlaStatus, getGuiaStatus, type SlaStatus, type GuiaStatusType } from "@/lib/guias/sla";
import { getOrigemAgendamento, getStatusPrestador } from "@/lib/guias/blocklist";
import { usePrestadoresBloqueados } from "@/hooks/usePrestadoresBloqueados";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, CheckCircle, Clock, FileText, XCircle, Activity, Users, Building, CircleDot, Play, Loader, CheckCheck } from "lucide-react";
import { format, subDays, startOfDay, isWeekend } from "date-fns";
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
  solicitante_nome: string | null;
  guia_gestao: { compareceu_status: string; atendimento_lancado: string; aso_anexado: string; sla_final?: string | null } | { compareceu_status: string; atendimento_lancado: string; aso_anexado: string; sla_final?: string | null }[] | null;
};

function getGestao(guia_gestao: GuiaDash["guia_gestao"]) {
  if (!guia_gestao) return undefined;
  if (Array.isArray(guia_gestao)) return guia_gestao[0] ?? undefined;
  return guia_gestao;
}

type ExameDash = { guia_codigo: string; exame_nome: string | null };

const COLORS = {
  EM_DIA: "hsl(142, 71%, 45%)",
  ATENCAO: "hsl(38, 92%, 50%)",
  ATRASADO: "hsl(0, 72%, 51%)",
};

const STATUS_COLORS = {
  PENDENTE: "hsl(220, 9%, 60%)",
  INICIADA: "hsl(217, 91%, 60%)",
  EM_ANDAMENTO: "hsl(25, 95%, 53%)",
  FINALIZADA: "hsl(142, 71%, 35%)",
};

function getPreviousBusinessDay(referenceDate: Date, feriados: string[] = []): Date {
  let d = new Date(referenceDate);
  d.setHours(0, 0, 0, 0);
  do {
    d = subDays(d, 1);
  } while (isWeekend(d) || feriados.includes(format(d, "yyyy-MM-dd")));
  return d;
}

interface GuiasDashboardProps {
  onNavigateToList?: (filters: Record<string, any>) => void;
}

export default function GuiasDashboard({ onNavigateToList }: GuiasDashboardProps) {
  const queryClient = useQueryClient();
  const { isPrestadorBloqueado, isLoading: loadingBloqueados } = usePrestadoresBloqueados();

  const { data: feriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data } = await supabase.from("feriados").select("data");
      return data?.map((f: any) => f.data) ?? [];
    },
  });

  const { data: lastImport } = useQuery({
    queryKey: ["last-import"],
    queryFn: async () => {
      const { data } = await supabase.from("guia_imports").select("imported_at").order("imported_at", { ascending: false }).limit(1);
      return data?.[0]?.imported_at ?? null;
    },
  });

  const { data: guiasRaw, isLoading: loadingGuias } = useQuery({
    queryKey: ["dashboard-guias"],
    queryFn: async () => {
      const allData: GuiaDash[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("guias")
          .select("id, guia_codigo, data_guia, data_agendamento, empresa_nome, prestador_nome, tipo_exame, atendido_texto, solicitante_nome, guia_gestao(compareceu_status, atendimento_lancado, aso_anexado, sla_final)")
          .gte("data_guia", "2026-01-01")
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...(data as unknown as GuiaDash[]));
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData;
    },
  });

  const isLoading = loadingGuias || loadingBloqueados;
  const guias = guiasRaw?.filter((g) => !isPrestadorBloqueado(g.prestador_nome)) ?? [];

  const { data: exames } = useQuery({
    queryKey: ["dashboard-exames"],
    queryFn: async () => {
      const allData: ExameDash[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase.from("guia_exames").select("guia_codigo, exame_nome").range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...(data as ExameDash[]));
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-gestao-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "guia_gestao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-guias"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  if (isLoading || !guias) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const guiasWithData = guias.map((g) => {
    const gestao = getGestao(g.guia_gestao);
    const comp = gestao?.compareceu_status ?? "NAO_INFORMADO";
    const atendLancado = gestao?.atendimento_lancado ?? "NAO_INFORMADO";
    const asoAnexado = gestao?.aso_anexado ?? "NAO_INFORMADO";
    const dataBase = g.data_agendamento ?? g.data_guia;
    const sla = getSlaStatus(dataBase, atendLancado, feriados ?? [], gestao?.sla_final);
    const guiaStatus = getGuiaStatus(comp, atendLancado, asoAnexado);
    const origem = getOrigemAgendamento(g.solicitante_nome);
    const statusPrest = getStatusPrestador(g.prestador_nome);
    return { ...g, sla, guiaStatus, gestao, origem, statusPrest };
  });

  const today = startOfDay(new Date());
  const thisWeekStart = subDays(today, 7);
  const thisMonthStart = subDays(today, 30);

  const lastImportDate = lastImport ? startOfDay(new Date(lastImport)) : today;
  const lastBusinessDay = getPreviousBusinessDay(lastImportDate, feriados ?? []);
  const lastBusinessDayStr = format(lastBusinessDay, "yyyy-MM-dd");

  const guiasUltimas = guiasWithData.filter((g) => g.data_guia === lastBusinessDayStr).length;
  const guiasSemana = guiasWithData.filter((g) => g.data_guia && new Date(g.data_guia + "T00:00:00") >= thisWeekStart).length;
  const guiasMes = guiasWithData.filter((g) => g.data_guia && new Date(g.data_guia + "T00:00:00") >= thisMonthStart).length;
  const atrasadas = guiasWithData.filter((g) => g.sla === "ATRASADO").length;
  const emAtencao = guiasWithData.filter((g) => g.sla === "ATENCAO").length;
  const semPrestador = guiasWithData.filter((g) => g.statusPrest === "SEM PRESTADOR").length;

  // Status da Guia counts
  const pendentes = guiasWithData.filter((g) => g.guiaStatus === "PENDENTE").length;
  const iniciadas = guiasWithData.filter((g) => g.guiaStatus === "INICIADA").length;
  const emAndamento = guiasWithData.filter((g) => g.guiaStatus === "EM_ANDAMENTO").length;
  const finalizadas = guiasWithData.filter((g) => g.guiaStatus === "FINALIZADA").length;
  const finalizadasComAtraso = guiasWithData.filter((g) => g.guiaStatus === "FINALIZADA" && g.sla === "ATRASADO").length;

  const origemCliente = guiasWithData.filter((g) => g.origem === "CLIENTE").length;
  const origemPreverMed = guiasWithData.filter((g) => g.origem === "PREVERMED").length;

  // Daily chart
  const dailyMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) dailyMap.set(format(subDays(today, i), "yyyy-MM-dd"), 0);
  guiasWithData.forEach((g) => { if (g.data_guia && dailyMap.has(g.data_guia)) dailyMap.set(g.data_guia, (dailyMap.get(g.data_guia) ?? 0) + 1); });
  const dailyData = Array.from(dailyMap.entries()).map(([date, count]) => ({ date: format(new Date(date + "T00:00:00"), "dd/MM", { locale: ptBR }), guias: count }));

  // Prestador atrasos
  const prestadorAtrasos = new Map<string, number>();
  guiasWithData.filter((g) => g.sla === "ATRASADO").forEach((g) => { const p = g.prestador_nome || "Sem prestador"; prestadorAtrasos.set(p, (prestadorAtrasos.get(p) ?? 0) + 1); });
  const prestadorData = Array.from(prestadorAtrasos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: name.length > 20 ? name.substring(0, 20) + "…" : name, atrasos: count }));

  // Empresa
  const empresaMap = new Map<string, number>();
  guiasWithData.forEach((g) => { const e = g.empresa_nome || "Sem empresa"; empresaMap.set(e, (empresaMap.get(e) ?? 0) + 1); });
  const empresaData = Array.from(empresaMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: name.length > 20 ? name.substring(0, 20) + "…" : name, guias: count }));

  // Exames
  const exameMap = new Map<string, number>();
  exames?.forEach((e) => { const name = e.exame_nome || "Sem nome"; exameMap.set(name, (exameMap.get(name) ?? 0) + 1); });
  const exameData = Array.from(exameMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: name.length > 25 ? name.substring(0, 25) + "…" : name, total: count }));

  // SLA pie
  const slaCount = { EM_DIA: 0, ATENCAO: 0, ATRASADO: 0 };
  guiasWithData.forEach((g) => { slaCount[g.sla]++; });
  const slaData = [
    { name: "Em Dia", value: slaCount.EM_DIA, color: COLORS.EM_DIA },
    { name: "Atenção", value: slaCount.ATENCAO, color: COLORS.ATENCAO },
    { name: "Atrasado", value: slaCount.ATRASADO, color: COLORS.ATRASADO },
  ].filter((d) => d.value > 0);

  // Status da Guia pie
  const statusCount = { PENDENTE: 0, INICIADA: 0, EM_ANDAMENTO: 0, FINALIZADA: 0 };
  guiasWithData.forEach((g) => { statusCount[g.guiaStatus]++; });
  const statusData = [
    { name: "Pendente", value: statusCount.PENDENTE, color: STATUS_COLORS.PENDENTE },
    { name: "Iniciada", value: statusCount.INICIADA, color: STATUS_COLORS.INICIADA },
    { name: "Em Andamento", value: statusCount.EM_ANDAMENTO, color: STATUS_COLORS.EM_ANDAMENTO },
    { name: "Finalizada", value: statusCount.FINALIZADA, color: STATUS_COLORS.FINALIZADA },
  ].filter((d) => d.value > 0);

  // Origem pie
  const origemData = [
    { name: "Cliente", value: origemCliente, color: "hsl(220, 70%, 55%)" },
    { name: "PreverMed", value: origemPreverMed, color: "hsl(160, 60%, 45%)" },
  ].filter((d) => d.value > 0);

  const handleCardClick = (filterOverrides: Record<string, any>) => {
    if (onNavigateToList) {
      onNavigateToList(filterOverrides);
    }
  };

  const slaCards = [
    { label: "Atrasadas (SLA)", value: atrasadas, icon: XCircle, color: "text-destructive",
      onClick: () => handleCardClick({ sla: "ATRASADO" }) },
    { label: "Em Atenção (SLA)", value: emAtencao, icon: AlertTriangle, color: "text-yellow-500",
      onClick: () => handleCardClick({ sla: "ATENCAO" }) },
    { label: "Em Dia (SLA)", value: slaCount.EM_DIA, icon: CheckCircle, color: "text-green-500",
      onClick: () => handleCardClick({ sla: "EM_DIA" }) },
  ];

  const statusCards = [
    { label: "Pendentes", value: pendentes, icon: CircleDot, color: "text-muted-foreground",
      onClick: () => handleCardClick({ statusGuia: "PENDENTE" }) },
    { label: "Iniciadas", value: iniciadas, icon: Play, color: "text-blue-500",
      onClick: () => handleCardClick({ statusGuia: "INICIADA" }) },
    { label: "Em Andamento", value: emAndamento, icon: Loader, color: "text-orange-500",
      onClick: () => handleCardClick({ statusGuia: "EM_ANDAMENTO" }) },
    { label: "Finalizadas", value: finalizadas, icon: CheckCheck, color: "text-green-600",
      onClick: () => handleCardClick({ statusGuia: "FINALIZADA" }) },
    { label: "Finalizadas c/ Atraso", value: finalizadasComAtraso, icon: AlertTriangle, color: "text-destructive",
      onClick: () => handleCardClick({ statusGuia: "FINALIZADA", sla: "ATRASADO" }) },
  ];

  const volumeCards = [
    { label: `Últimas guias (${format(lastBusinessDay, "dd/MM")})`, value: guiasUltimas, icon: FileText, color: "text-primary",
      onClick: () => handleCardClick({ dataGuiaInicio: lastBusinessDay, dataGuiaFim: lastBusinessDay }) },
    { label: "Últimos 7 dias", value: guiasSemana, icon: Activity, color: "text-primary",
      onClick: () => handleCardClick({ dataGuiaInicio: thisWeekStart, dataGuiaFim: today }) },
    { label: "Últimos 30 dias", value: guiasMes, icon: FileText, color: "text-primary",
      onClick: () => handleCardClick({ dataGuiaInicio: thisMonthStart, dataGuiaFim: today }) },
    { label: "Sem prestador", value: semPrestador, icon: Users, color: "text-orange-500",
      onClick: () => handleCardClick({ statusPrestador: "SEM PRESTADOR" }) },
  ];

  const renderCards = (cards: typeof slaCards, title: string) => (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className={`grid grid-cols-${Math.min(cards.length, 5)} gap-3`}>
        {cards.map((c) => (
          <Card key={c.label} className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={c.onClick}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                <span className="text-[11px] text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard de Guias</h1>
        <p className="text-muted-foreground">Visão geral — {guias.length} guias válidas</p>
      </div>

      {/* Volume cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {volumeCards.map((c) => (
          <Card key={c.label} className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={c.onClick}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                <span className="text-[11px] text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SLA cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">SLA — Prazo da Ação do Setor</h3>
        <div className="grid grid-cols-3 gap-3">
          {slaCards.map((c) => (
            <Card key={c.label} className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={c.onClick}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                  <span className="text-[11px] text-muted-foreground">{c.label}</span>
                </div>
                <p className="text-xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Status da Guia cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Status da Guia — Andamento Operacional</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {statusCards.map((c) => (
            <Card key={c.label} className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={c.onClick}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                  <span className="text-[11px] text-muted-foreground">{c.label}</span>
                </div>
                <p className="text-xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Origem agendamento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => handleCardClick({ origemAgendamento: "CLIENTE" })}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Building className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[11px] text-muted-foreground">Agend. Cliente</span>
            </div>
            <p className="text-xl font-bold">{origemCliente}</p>
            <p className="text-[10px] text-muted-foreground">{guias.length > 0 ? ((origemCliente / guias.length) * 100).toFixed(1) : 0}%</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => handleCardClick({ origemAgendamento: "PREVERMED" })}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[11px] text-muted-foreground">Agend. PreverMed</span>
            </div>
            <p className="text-xl font-bold">{origemPreverMed}</p>
            <p className="text-[10px] text-muted-foreground">{guias.length > 0 ? ((origemPreverMed / guias.length) * 100).toFixed(1) : 0}%</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => handleCardClick({ compareceu: "COMPARECEU" })}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[11px] text-muted-foreground">Compareceram</span>
            </div>
            <p className="text-xl font-bold">{guiasWithData.filter((g) => g.gestao?.compareceu_status === "COMPARECEU").length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => handleCardClick({ compareceu: "NAO_COMPARECEU" })}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[11px] text-muted-foreground">Não Compareceram</span>
            </div>
            <p className="text-xl font-bold">{guiasWithData.filter((g) => g.gestao?.compareceu_status === "NAO_COMPARECEU").length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Guias por Dia (últimos 30 dias)</CardTitle></CardHeader>
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição de SLA</CardTitle></CardHeader>
          <CardContent>
            {slaData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={slaData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {slaData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Status da Guia</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Origem do Agendamento</CardTitle></CardHeader>
          <CardContent>
            {origemData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={origemData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {origemData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Atrasos por Prestador</CardTitle></CardHeader>
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Volume por Empresa</CardTitle></CardHeader>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Exames Mais Frequentes</CardTitle></CardHeader>
          <CardContent>
            {exameData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados de exames</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
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
    </div>
  );
}
