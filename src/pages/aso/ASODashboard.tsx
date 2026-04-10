import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useASODashboardData } from "@/hooks/useASODashboard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Users, Building2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  importado: "Importado",
  em_triagem: "Em Triagem",
  aguardando_exames: "Aguard. Exames",
  pronto_assinatura_medica: "Assin. Médica",
  em_escaneamento: "Escaneamento",
  liberado: "Liberado",
  liberado_faturamento: "Faturamento",
  finalizado: "Finalizado",
};

const STATUS_CHART_COLORS = [
  "hsl(var(--muted-foreground))",
  "hsl(210,80%,55%)",
  "hsl(30,80%,55%)",
  "hsl(270,60%,55%)",
  "hsl(45,80%,50%)",
  "hsl(140,60%,45%)",
  "hsl(160,70%,40%)",
  "hsl(0,0%,60%)",
];

export default function ASODashboard() {
  const { data, isLoading } = useASODashboardData();

  if (isLoading || !data) {
    return <p className="text-muted-foreground text-center py-8">Carregando dashboard...</p>;
  }

  const statusPieData = Object.entries(data.byStatus).map(([k, v]) => ({
    name: STATUS_LABELS[k] || k,
    value: v,
  }));

  const unidadePieData = Object.entries(data.byUnidade).map(([k, v]) => ({
    name: k,
    value: v,
  }));

  return (
    <div className="space-y-6">
      {/* SLA Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Em Dia
            </div>
            <p className="text-2xl font-bold text-green-700">{data.sla.emDia}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5 text-yellow-500" /> Atenção
            </div>
            <p className="text-2xl font-bold text-yellow-700">{data.sla.atencao}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Atrasados
            </div>
            <p className="text-2xl font-bold text-red-700">{data.sla.atrasados}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" /> Ativos
            </div>
            <p className="text-2xl font-bold">{data.sla.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {statusPieData.map((_, i) => (
                    <Cell key={i} fill={STATUS_CHART_COLORS[i % STATUS_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Volume chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Volume Diário (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.volumeChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(v) => `Data: ${v}`} />
                <Bar dataKey="lapa" name="Lapa" fill="hsl(210,70%,55%)" stackId="a" />
                <Bar dataKey="osasco" name="Osasco" fill="hsl(30,70%,55%)" stackId="a" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Unidade */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Por Unidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={unidadePieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label>
                  <Cell fill="hsl(210,70%,55%)" />
                  <Cell fill="hsl(30,70%,55%)" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Prontuário */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tipo de Prontuário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            {Object.entries(data.byProntuario).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className="text-sm capitalize">{k}</span>
                <Badge variant="secondary">{v}</Badge>
              </div>
            ))}
            <div className="flex justify-between items-center border-t pt-2 mt-2">
              <span className="text-sm">SOCNET</span>
              <Badge variant="secondary">{data.socnet}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Não SOCNET</span>
              <Badge variant="secondary">{data.naoSocnet}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Setor ranking */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Ranking por Setor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            {data.setorRanking.length > 0 ? data.setorRanking.map((s) => (
              <div key={s.setor} className="flex justify-between items-center text-sm">
                <span className="truncate max-w-[120px]">{s.setor}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">μ {s.mediaDias}d</span>
                  {s.atrasados > 0 && <Badge variant="destructive" className="text-xs">{s.atrasados} atr.</Badge>}
                  <Badge variant="outline">{s.total}</Badge>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top empresas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top 10 Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.topEmpresas} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={150} />
              <Tooltip />
              <Bar dataKey="count" name="Atendimentos" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
