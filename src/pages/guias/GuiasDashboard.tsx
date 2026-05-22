import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  AlertTriangle, CheckCircle, Clock, FileText, XCircle, Activity, Users,
  Building, CircleDot, Play, Loader, CheckCheck, CalendarIcon, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

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

type Preset = "7" | "15" | "30" | "custom";

interface GuiasDashboardProps {
  onNavigateToList?: (filters: Record<string, any>) => void;
}

function fmtDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function GuiasDashboard({ onNavigateToList }: GuiasDashboardProps) {
  const queryClient = useQueryClient();

  const [preset, setPreset] = useState<Preset>("30");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { ini, fim } = useMemo(() => {
    const today = startOfDay(new Date());
    if (preset === "custom" && customRange?.from) {
      return { ini: customRange.from, fim: customRange.to ?? customRange.from };
    }
    const days = preset === "7" ? 7 : preset === "15" ? 15 : 30;
    return { ini: subDays(today, days - 1), fim: today };
  }, [preset, customRange]);

  const iniStr = fmtDate(ini);
  const fimStr = fmtDate(fim);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-guias-agregado", iniStr, fimStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_guias_agregado", {
        _periodo_ini: iniStr,
        _periodo_fim: fimStr,
      });
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-gestao-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "guia_gestao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-guias-agregado"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const t = data.totais ?? {};
  const total: number = t.total ?? 0;
  const ultimoDiaUtil = data.ultimo_dia_util ? new Date(data.ultimo_dia_util + "T00:00:00") : new Date();

  const dailyData = (data.daily ?? []).map((d: any) => ({
    date: format(new Date(d.date + "T00:00:00"), "dd/MM", { locale: ptBR }),
    guias: d.count,
  }));

  const prestadorData = (data.prestador_atrasos ?? []).map((p: any) => ({
    name: p.name.length > 20 ? p.name.substring(0, 20) + "…" : p.name,
    atrasos: p.count,
  }));
  const empresaData = (data.empresas ?? []).map((e: any) => ({
    name: e.name.length > 20 ? e.name.substring(0, 20) + "…" : e.name,
    guias: e.count,
  }));
  const exameData = (data.exames ?? []).map((e: any) => ({
    name: e.name.length > 25 ? e.name.substring(0, 25) + "…" : e.name,
    total: e.count,
  }));
  const slaMensal = (data.sla_mensal ?? []).map((m: any) => ({
    mes: m.mes_label,
    "Em Dia": m.em_dia,
    "Atenção": m.atencao,
    "Atrasado": m.atrasado,
    "% Atraso": m.total > 0 ? Number(((m.atrasado / m.total) * 100).toFixed(1)) : 0,
  }));

  const slaData = [
    { name: "Em Dia", value: t.em_dia ?? 0, color: COLORS.EM_DIA },
    { name: "Atenção", value: t.em_atencao ?? 0, color: COLORS.ATENCAO },
    { name: "Atrasado", value: t.atrasadas ?? 0, color: COLORS.ATRASADO },
  ].filter((d) => d.value > 0);
  const statusData = [
    { name: "Pendente", value: t.pendentes ?? 0, color: STATUS_COLORS.PENDENTE },
    { name: "Iniciada", value: t.iniciadas ?? 0, color: STATUS_COLORS.INICIADA },
    { name: "Em Andamento", value: t.em_andamento ?? 0, color: STATUS_COLORS.EM_ANDAMENTO },
    { name: "Finalizada", value: t.finalizadas ?? 0, color: STATUS_COLORS.FINALIZADA },
  ].filter((d) => d.value > 0);
  const origemData = [
    { name: "Cliente", value: t.origem_cliente ?? 0, color: "hsl(220, 70%, 55%)" },
    { name: "PreverMed", value: t.origem_prevermed ?? 0, color: "hsl(160, 60%, 45%)" },
  ].filter((d) => d.value > 0);

  const handleCardClick = (filterOverrides: Record<string, any>) => {
    if (onNavigateToList) onNavigateToList({ ...filterOverrides, dataGuiaInicio: ini, dataGuiaFim: fim });
  };

  const volumeCards = [
    { label: `Últimas guias (${format(ultimoDiaUtil, "dd/MM")})`, value: t.ultimas ?? 0, icon: FileText, color: "text-primary",
      onClick: () => onNavigateToList?.({ dataGuiaInicio: ultimoDiaUtil, dataGuiaFim: ultimoDiaUtil }) },
    { label: "No período", value: total, icon: Activity, color: "text-primary",
      onClick: () => handleCardClick({}) },
    { label: "Sem prestador", value: t.sem_prestador ?? 0, icon: Users, color: "text-orange-500",
      onClick: () => handleCardClick({ statusPrestador: "SEM PRESTADOR" }) },
    { label: "Compareceram", value: t.compareceram ?? 0, icon: CheckCircle, color: "text-green-500",
      onClick: () => handleCardClick({ compareceu: "COMPARECEU" }) },
  ];
  const slaCards = [
    { label: "Atrasadas (SLA)", value: t.atrasadas ?? 0, icon: XCircle, color: "text-destructive",
      onClick: () => handleCardClick({ sla: "ATRASADO" }) },
    { label: "Em Atenção (SLA)", value: t.em_atencao ?? 0, icon: AlertTriangle, color: "text-yellow-500",
      onClick: () => handleCardClick({ sla: "ATENCAO" }) },
    { label: "Em Dia (SLA)", value: t.em_dia ?? 0, icon: CheckCircle, color: "text-green-500",
      onClick: () => handleCardClick({ sla: "EM_DIA" }) },
  ];
  const statusCards = [
    { label: "Pendentes", value: t.pendentes ?? 0, icon: CircleDot, color: "text-muted-foreground",
      onClick: () => handleCardClick({ statusGuia: "PENDENTE" }) },
    { label: "Iniciadas", value: t.iniciadas ?? 0, icon: Play, color: "text-blue-500",
      onClick: () => handleCardClick({ statusGuia: "INICIADA" }) },
    { label: "Em Andamento", value: t.em_andamento ?? 0, icon: Loader, color: "text-orange-500",
      onClick: () => handleCardClick({ statusGuia: "EM_ANDAMENTO" }) },
    { label: "Finalizadas", value: t.finalizadas ?? 0, icon: CheckCheck, color: "text-green-600",
      onClick: () => handleCardClick({ statusGuia: "FINALIZADA" }) },
    { label: "Finalizadas c/ Atraso", value: t.finalizadas_com_atraso ?? 0, icon: AlertTriangle, color: "text-destructive",
      onClick: () => handleCardClick({ statusGuia: "FINALIZADA", sla: "ATRASADO" }) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Guias</h1>
          <p className="text-muted-foreground text-sm">
            {format(ini, "dd/MM/yyyy")} – {format(fim, "dd/MM/yyyy")} · {total} guias no período
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["7", "15", "30"] as const).map((p) => (
            <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => setPreset(p)}>
              {p} dias
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={preset === "custom" ? "default" : "outline"} className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {preset === "custom" && customRange?.from
                  ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to ?? customRange.from, "dd/MM")}`
                  : "Personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={(r) => {
                  setCustomRange(r);
                  if (r?.from && r?.to) setPreset("custom");
                }}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Guias por Dia (período)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(dailyData.length / 10))} />
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

      {/* Comparativo mensal — SLA por mês (últimos 6 meses) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">SLA — Comparativo mês a mês (últimos 6 meses)</CardTitle>
          <p className="text-[11px] text-muted-foreground">Independe do período selecionado acima.</p>
        </CardHeader>
        <CardContent>
          {slaMensal.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={slaMensal}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Em Dia" stackId="a" fill={COLORS.EM_DIA} />
                <Bar yAxisId="left" dataKey="Atenção" stackId="a" fill={COLORS.ATENCAO} />
                <Bar yAxisId="left" dataKey="Atrasado" stackId="a" fill={COLORS.ATRASADO} />
                <Line yAxisId="right" type="monotone" dataKey="% Atraso" stroke="hsl(var(--foreground))" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

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
