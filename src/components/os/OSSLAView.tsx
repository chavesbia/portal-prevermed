import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { OSKPICard } from '@/components/os/OSKPICard';
import { OrdemServico, slaStatusColors, slaStatusLabels, SLAStatus } from '@/types/os';
import { calcOSSLA } from '@/lib/os/sla';
import { useFeriados } from '@/hooks/useFeriados';

interface OSSLAViewProps {
  ordens: OrdemServico[];
}

const SLA_COLORS: Record<SLAStatus, string> = {
  em_dia: 'hsl(142, 76%, 36%)',
  atencao: 'hsl(38, 92%, 50%)',
  atrasado: 'hsl(0, 84%, 60%)',
  encerrado: 'hsl(215, 15%, 60%)',
  sem_prazo: 'hsl(215, 15%, 40%)',
};

export function OSSLAView({ ordens }: OSSLAViewProps) {
  const { data: feriados } = useFeriados();
  const feriadosISO = useMemo(() => feriados || [], [feriados]);

  const rows = useMemo(() => ordens.map(o => ({
    ordem: o,
    sla: calcOSSLA({
      data_registro: o.data_registro,
      prazo_acordado: o.prazo_acordado,
      status_os: o.status_os,
      updated_at: o.updated_at,
      feriados: feriadosISO,
    }),
  })), [ordens, feriadosISO]);

  const abertas = rows.filter(r => r.ordem.status_os !== 'Encerrado');
  const encerradas = rows.filter(r => r.ordem.status_os === 'Encerrado');

  // SLA pausado: sem marcação de atraso até termos amostragem real de tempos por serviço.
  const tempoMedio = (list: typeof rows) => list.length ? Math.round(list.reduce((t, r) => t + r.sla.diasCorridos, 0) / list.length) : 0;
  const kpis = {
    abertas: abertas.length,
    mediaAbertas: tempoMedio(abertas),
    encerradas: encerradas.length,
    mediaEncerradas: tempoMedio(encerradas),
  };

  const tipoMap: Record<string, { total: number; count: number }> = {};
  encerradas.forEach(r => {
    const k = (r.ordem as any).tipo_os || 'Outros';
    if (!tipoMap[k]) tipoMap[k] = { total: 0, count: 0 };
    tipoMap[k].total += r.sla.diasCorridos; tipoMap[k].count += 1;
  });
  const tipoData = Object.entries(tipoMap).map(([name, d]) => ({ name, media: Math.round(d.total / d.count), count: d.count }));

  const maisAntigas = [...abertas].sort((x, y) => y.sla.diasCorridos - x.sla.diasCorridos).slice(0, 10);

  // Tempo médio (dias úteis) por responsável entre encerradas
  const respMap: Record<string, { total: number; count: number }> = {};
  encerradas.forEach(r => {
    const nome = r.ordem.responsavel_atual;
    if (!respMap[nome]) respMap[nome] = { total: 0, count: 0 };
    respMap[nome].total += r.sla.diasCorridos;
    respMap[nome].count += 1;
  });
  const respPerf = Object.entries(respMap).map(([name, d]) => ({
    name, media: Math.round(d.total / d.count), count: d.count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">SLA das Ordens de Serviço</h2>
        <p className="text-muted-foreground">
          Contabilizado por OS considerando os status <strong>Não Iniciado</strong> e <strong>Em Andamento</strong>. O SLA congela ao encerrar.
        </p>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
        <strong>Alertas de atraso pausados.</strong> Estamos coletando o tempo real de execução por tipo de serviço para definir prazos justos.
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OSKPICard title="OS em aberto" value={kpis.abertas} subtitle="Não iniciadas e em andamento" icon={Clock} variant="primary" />
        <OSKPICard title="Tempo médio em aberto" value={`${kpis.mediaAbertas}d`} subtitle="Dias úteis desde o registro" icon={Clock} />
        <OSKPICard title="Encerradas" value={kpis.encerradas} subtitle="Amostra de tempo real" icon={CheckCircle} variant="success" />
        <OSKPICard title="Tempo médio de conclusão" value={`${kpis.mediaEncerradas}d`} subtitle="Dias úteis (OS encerradas)" icon={TrendingUp} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Tempo médio de conclusão por tipo</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {tipoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tipoData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [`${v} dias úteis`, 'Média']} />
                    <Bar dataKey="media" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Em aberto há mais tempo (Top 10)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {maisAntigas.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma OS em aberto.</p>}
              {maisAntigas.map((r, i) => (
                <div key={r.ordem.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">OS #{r.ordem.numero_os}</span>
                      <Badge variant="outline" className="whitespace-nowrap">{r.sla.diasCorridos} dias úteis</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{r.ordem.empresa_cliente} · {r.ordem.responsavel_atual}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Tempo médio por Responsável (OS encerradas)</CardTitle></CardHeader>
        <CardContent>
          {respPerf.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma OS encerrada ainda.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {respPerf.map(r => (
                <div key={r.name} className="rounded-lg border p-4">
                  <h4 className="font-medium truncate">{r.name}</h4>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{r.media}</span>
                    <span className="text-sm text-muted-foreground">dias úteis (média)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{r.count} OS encerradas</p>
                  <Progress value={Math.min(100, r.media * 5)} className="h-2 mt-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Detalhamento por OS</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium text-muted-foreground">Nº OS</th>
                  <th className="pb-3 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="pb-3 text-left font-medium text-muted-foreground">Registro</th>
                  <th className="pb-3 text-left font-medium text-muted-foreground">Prazo</th>
                  <th className="pb-3 text-left font-medium text-muted-foreground">Status OS</th>
                  <th className="pb-3 text-left font-medium text-muted-foreground">Dias úteis</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ordem.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 font-medium">{r.ordem.numero_os}</td>
                    <td className="py-2 max-w-[220px] truncate">{r.ordem.empresa_cliente}</td>
                    <td className="py-2 text-muted-foreground">{r.ordem.data_registro.split('-').reverse().join('/')}</td>
                    <td className="py-2 text-muted-foreground">{r.ordem.prazo_acordado ? r.ordem.prazo_acordado.split('-').reverse().join('/') : '—'}</td>
                    <td className="py-2"><Badge variant="outline">{r.ordem.status_os}</Badge></td>
                    <td className="py-2 whitespace-nowrap">{r.sla.diasCorridos}d</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma OS.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
