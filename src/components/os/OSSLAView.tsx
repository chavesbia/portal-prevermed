import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { OSKPICard } from '@/components/os/OSKPICard';
import { OrdemServico } from '@/types/os';

interface OSSLAViewProps {
  ordens: OrdemServico[];
}

export function OSSLAView({ ordens }: OSSLAViewProps) {
  const encerradas = ordens.filter(o => o.status_os === 'Encerrado');

  const slaData = encerradas.map(ordem => {
    const reg = parseISO(ordem.data_registro);
    const upd = parseISO(ordem.updated_at);
    const tempoTotal = Math.max(differenceInDays(upd, reg), 1);
    const dentroPrazo = !ordem.prazo_acordado || upd <= parseISO(ordem.prazo_acordado);
    return {
      numeroOS: ordem.numero_os,
      cliente: ordem.empresa_cliente.slice(0, 15),
      tempoTotal,
      dentroPrazo,
    };
  });

  const avgSLA = slaData.length > 0
    ? Math.round(slaData.reduce((acc, s) => acc + s.tempoTotal, 0) / slaData.length)
    : 0;

  const dentroPrazo = slaData.filter(s => s.dentroPrazo).length;
  const percentualDentroPrazo = slaData.length > 0
    ? Math.round((dentroPrazo / slaData.length) * 100) : 0;

  // SLA by service type
  const svcMap: Record<string, { total: number; count: number }> = {};
  encerradas.forEach(o => {
    o.servicos?.forEach(s => {
      if (!svcMap[s.tipo]) svcMap[s.tipo] = { total: 0, count: 0 };
      const inicio = s.data_inicio ? parseISO(s.data_inicio) : parseISO(o.data_registro);
      const fim = s.data_conclusao ? parseISO(s.data_conclusao) : parseISO(o.updated_at);
      svcMap[s.tipo].total += Math.max(differenceInDays(fim, inicio), 1);
      svcMap[s.tipo].count += 1;
    });
  });
  const serviceSLA = Object.entries(svcMap)
    .map(([name, d]) => ({ name: name.length > 12 ? name.slice(0, 12) + '...' : name, fullName: name, media: Math.round(d.total / d.count), count: d.count }))
    .sort((a, b) => b.media - a.media);

  // Top 10 longest
  const topLongest = [...slaData].sort((a, b) => b.tempoTotal - a.tempoTotal).slice(0, 10);

  // Performance by responsible
  const respMap: Record<string, { total: number; count: number }> = {};
  encerradas.forEach(o => {
    if (!respMap[o.responsavel_atual]) respMap[o.responsavel_atual] = { total: 0, count: 0 };
    const t = Math.max(differenceInDays(parseISO(o.updated_at), parseISO(o.data_registro)), 1);
    respMap[o.responsavel_atual].total += t;
    respMap[o.responsavel_atual].count += 1;
  });
  const respPerf = Object.entries(respMap).map(([name, d]) => ({
    name, media: Math.round(d.total / d.count), count: d.count,
  }));

  const ChartTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="rounded-lg border bg-card p-3 shadow-lg">
          <p className="font-medium">{payload[0].payload.fullName || payload[0].payload.name}</p>
          <p className="text-sm text-muted-foreground">Média: {payload[0].value} dias</p>
          {payload[0].payload.count && <p className="text-xs text-muted-foreground">{payload[0].payload.count} OS finalizadas</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Métricas de SLA</h2>
        <p className="text-muted-foreground">Análise do tempo de conclusão das ordens de serviço</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OSKPICard title="SLA Médio" value={`${avgSLA} dias`} subtitle="Tempo médio de conclusão" icon={Clock} variant="primary" />
        <OSKPICard title="Dentro do Prazo" value={`${percentualDentroPrazo}%`} subtitle={`${dentroPrazo} de ${slaData.length} OS`} icon={CheckCircle} variant="success" />
        <OSKPICard title="OS Finalizadas" value={encerradas.length} subtitle="Total encerradas" icon={TrendingUp} />
        <OSKPICard title="Fora do Prazo" value={slaData.length - dentroPrazo} subtitle="OS com atraso" icon={AlertTriangle} variant={slaData.length - dentroPrazo > 0 ? 'destructive' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">SLA por Tipo de Serviço</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[350px]">
              {serviceSLA.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceSLA} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="media" radius={[0, 4, 4, 0]}>
                      {serviceSLA.map((entry, i) => (
                        <Cell key={i} fill={entry.media > avgSLA ? 'hsl(38, 92%, 50%)' : 'hsl(210, 100%, 50%)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados de OS finalizadas</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Top 10 — Maior Tempo de Conclusão</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topLongest.map((item, index) => (
                <div key={item.numeroOS} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">{index + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">OS #{item.numeroOS}</span>
                      <Badge variant={item.dentroPrazo ? 'default' : 'destructive'}>{item.tempoTotal} dias</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.cliente}</p>
                    <Progress value={Math.min((item.tempoTotal / (topLongest[0]?.tempoTotal || 1)) * 100, 100)} className="h-1.5 mt-1" />
                  </div>
                </div>
              ))}
              {topLongest.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma OS finalizada encontrada.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Performance por Responsável</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {respPerf.map(resp => (
              <div key={resp.name} className="rounded-lg border p-4">
                <h4 className="font-medium truncate">{resp.name}</h4>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{resp.media}</span>
                  <span className="text-sm text-muted-foreground">dias (média)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{resp.count} OS finalizadas</p>
                <Progress value={Math.max(0, 100 - (resp.media / (avgSLA || 1)) * 50)} className="h-2 mt-2" />
              </div>
            ))}
            {respPerf.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-4">Sem dados disponíveis</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
