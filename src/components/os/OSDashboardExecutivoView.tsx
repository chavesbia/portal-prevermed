import { useMemo } from 'react';
import { Users, Timer, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OSKPICard } from '@/components/os/OSKPICard';
import { useOSProdutividade } from '@/hooks/useOSProdutividade';

export function OSDashboardExecutivoView() {
  const { rows, isLoading } = useOSProdutividade();

  const stats = useMemo(() => {
    const totalOS = rows.reduce((s, r) => s + Number(r.total_os || 0), 0);
    const encerradas = rows.reduce((s, r) => s + Number(r.os_encerradas || 0), 0);
    const atrasadas = rows.reduce((s, r) => s + Number(r.os_atrasadas || 0), 0);
    const tempos = rows.map(r => r.tempo_medio_dias).filter((v): v is number => v != null);
    const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
    return { totalOS, encerradas, atrasadas, tempoMedio };
  }, [rows]);

  const cargaData = rows.slice(0, 12).map(r => ({
    name: r.responsavel.split(' ').slice(0, 2).join(' '),
    fullName: r.responsavel,
    Encerradas: Number(r.os_encerradas),
    'Em andamento': Number(r.os_em_andamento),
    Atrasadas: Number(r.os_atrasadas),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard Executivo</h2>
        <p className="text-sm text-muted-foreground">Produtividade e carga por responsável — últimos 90 dias.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OSKPICard title="Total de OS (90d)" value={stats.totalOS} icon={TrendingUp} variant="primary" />
        <OSKPICard title="Encerradas" value={stats.encerradas} icon={Users} variant="success" />
        <OSKPICard title="Atrasadas" value={stats.atrasadas} icon={AlertTriangle} variant="destructive" />
        <OSKPICard title="Tempo médio" value={`${stats.tempoMedio.toFixed(1)}d`} icon={Timer} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Carga por Responsável</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[380px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Carregando…</div>
            ) : cargaData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cargaData} margin={{ bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} angle={-30} textAnchor="end" height={70} interval={0} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Encerradas" stackId="a" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Em andamento" stackId="a" fill="hsl(45, 93%, 47%)" />
                  <Bar dataKey="Atrasadas" stackId="a" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Produtividade Detalhada</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Sem dados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-muted-foreground">Responsável</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Total OS</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Encerradas</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Em andamento</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Atrasadas</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Serviços</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Tempo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.responsavel} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 font-medium">{r.responsavel}</td>
                      <td className="py-2 text-right">{r.total_os}</td>
                      <td className="py-2 text-right text-emerald-700">{r.os_encerradas}</td>
                      <td className="py-2 text-right text-blue-700">{r.os_em_andamento}</td>
                      <td className="py-2 text-right text-red-700">{r.os_atrasadas}</td>
                      <td className="py-2 text-right">{r.servicos_encerrados}/{r.total_servicos}</td>
                      <td className="py-2 text-right">{r.tempo_medio_dias != null ? `${Number(r.tempo_medio_dias).toFixed(1)}d` : '—'}</td>
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
