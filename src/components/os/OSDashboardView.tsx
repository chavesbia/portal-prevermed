import { FileText, Clock, CheckCircle, AlertCircle, TrendingUp, Timer } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OSKPICard } from '@/components/os/OSKPICard';
import { OSFilterBar } from '@/components/os/OSFilterBar';
import { Badge } from '@/components/ui/badge';
import { OrdemServico, statusOSColors, statusServicoColors } from '@/types/os';
import { differenceInDays } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  'Não iniciado': 'hsl(215, 15%, 60%)',
  'Em andamento': 'hsl(210, 100%, 50%)',
  'Encerrado': 'hsl(142, 76%, 36%)',
};

const BAR_COLORS = [
  'hsl(210, 100%, 50%)', 'hsl(200, 100%, 45%)',
  'hsl(190, 100%, 40%)', 'hsl(180, 100%, 35%)', 'hsl(170, 100%, 35%)',
];

interface OSDashboardViewProps {
  ordens: OrdemServico[];
  filters: any;
  setFilters: any;
  responsaveis: string[];
}

export function OSDashboardView({ ordens, filters, setFilters, responsaveis }: OSDashboardViewProps) {
  const encerradas = ordens.filter(o => o.status_os === 'Encerrado');
  const slaDias = encerradas
    .map(o => o.data_emissao ? differenceInDays(new Date(o.updated_at), new Date(o.data_registro)) : null)
    .filter((n): n is number => n !== null && n >= 0);
  const slaMedio = slaDias.length ? (slaDias.reduce((a, b) => a + b, 0) / slaDias.length) : 0;
  const novosCount = ordens.reduce((acc, o) => acc + (o.servicos?.filter(s => s.tipo_os === 'Novo').length || 0), 0);

  const stats = {
    total: ordens.length,
    emAndamento: ordens.filter(o => o.status_os === 'Em andamento' || o.status_os === 'Em revisão interna').length,
    encerradas: encerradas.length,
    pendentes: ordens.filter(o => ['Não iniciado', 'Aguardando assinatura', 'Aguardando cliente'].includes(o.status_os)).length,
    novos: novosCount,
    slaMedio: slaMedio.toFixed(1),
  };

  // Status chart data
  const statusData = Object.entries(
    ordens.reduce((acc, o) => { acc[o.status_os] = (acc[o.status_os] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Responsavel chart data
  const respData = Object.entries(
    ordens.reduce((acc, o) => { acc[o.responsavel_atual] = (acc[o.responsavel_atual] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.split(' ').slice(0, 2).join(' '), fullName: name, value }))
    .sort((a, b) => b.value - a.value);

  // Servico chart data
  const svcData = Object.entries(
    ordens.reduce((acc, o) => {
      o.servicos?.forEach(s => { acc[s.tipo] = (acc[s.tipo] || 0) + 1; });
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Novo vs Revisão
  const nrData: Record<string, { novo: number; revisao: number }> = {};
  ordens.forEach(o => o.servicos?.forEach(s => {
    if (!nrData[s.tipo]) nrData[s.tipo] = { novo: 0, revisao: 0 };
    s.tipo_os === 'Novo' ? nrData[s.tipo].novo++ : nrData[s.tipo].revisao++;
  }));
  const nrChartData = Object.entries(nrData)
    .map(([name, d]) => ({ name, Novo: d.novo, Revisão: d.revisao, total: d.novo + d.revisao }))
    .sort((a, b) => b.total - a.total);

  // Recent table (first 8)
  const recent = ordens.slice(0, 8);

  const ChartTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="rounded-lg border bg-card p-3 shadow-lg">
          <p className="font-medium">{payload[0].name || payload[0].payload?.fullName || payload[0].payload?.name}</p>
          <p className="text-sm text-muted-foreground">{payload[0].value} OS</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <OSFilterBar filters={filters} setFilters={setFilters} responsaveis={responsaveis} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <OSKPICard title="Total de OS" value={stats.total} subtitle="Ordens registradas" icon={FileText} variant="primary" />
        <OSKPICard title="Em Andamento" value={stats.emAndamento} subtitle="Em execução" icon={Clock} variant="warning" />
        <OSKPICard title="Finalizadas" value={stats.encerradas} subtitle="Concluídas" icon={CheckCircle} variant="success" />
        <OSKPICard title="Pendentes" value={stats.pendentes} subtitle="Aguardando ação" icon={AlertCircle} variant="destructive" />
        <OSKPICard title="Novos" value={stats.novos} subtitle="Serviços novos" icon={TrendingUp} />
        <OSKPICard title="SLA Médio" value={`${stats.slaMedio}d`} subtitle="Tempo de conclusão" icon={Timer} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Chart */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Status das OS</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name] || 'hsl(215, 15%, 60%)'} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Responsavel Chart */}
        <Card>
          <CardHeader><CardTitle className="text-lg">OS por Responsável</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {respData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={respData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {respData.map((_, i) => <Cell key={i} fill="hsl(210, 100%, 50%)" />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tipo Servico Chart */}
        <Card>
          <CardHeader><CardTitle className="text-lg">OS por Tipo de Serviço</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {svcData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={svcData} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-45} textAnchor="end" interval={0} height={80} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {svcData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Novo vs Revisão */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Serviços: Novo vs Revisão</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {nrChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nrChartData} margin={{ left: 0, right: 20, top: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} angle={-45} textAnchor="end" height={80} interval={0} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="Novo" fill="hsl(210, 100%, 50%)" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="Revisão" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent OS Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Ordens Recentes</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma OS registrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-muted-foreground">Nº OS</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Cliente</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Serviço</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Status Serviço</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Status OS</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.flatMap(ordem =>
                    (ordem.servicos || []).map((servico, idx) => (
                      <tr key={`${ordem.id}-${servico.id}`} className={`border-b last:border-0 hover:bg-muted/50 ${idx > 0 ? 'bg-muted/20' : ''}`}>
                        <td className="py-2 font-medium">{idx === 0 ? ordem.numero_os : ''}</td>
                        <td className="py-2 max-w-[120px] truncate">{idx === 0 ? ordem.empresa_cliente : ''}</td>
                        <td className="py-2 font-medium">{servico.tipo}</td>
                        <td className="py-2 hidden md:table-cell">
                          <Badge variant={servico.tipo_os === 'Novo' ? 'default' : 'secondary'} className="text-xs">{servico.tipo_os}</Badge>
                        </td>
                        <td className="py-2">
                          <Badge className={`text-xs ${statusServicoColors[servico.status] || 'bg-muted'}`}>{servico.status}</Badge>
                        </td>
                        <td className="py-2 hidden xl:table-cell">
                          {idx === 0 && <Badge className={`text-xs ${statusOSColors[ordem.status_os] || 'bg-muted'}`}>{ordem.status_os}</Badge>}
                        </td>
                      </tr>
                    ))
                  )}
                  {recent.every(o => !o.servicos?.length) && recent.map(ordem => (
                    <tr key={ordem.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 font-medium">{ordem.numero_os}</td>
                      <td className="py-2">{ordem.empresa_cliente}</td>
                      <td className="py-2 text-muted-foreground" colSpan={4}>{ordem.tipo_servico_resumo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
