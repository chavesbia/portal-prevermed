import { useMemo, useState } from 'react';
import { DollarSign, Receipt, Percent, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OSKPICard } from '@/components/os/OSKPICard';
import { type Venda, useTodosItens } from '@/hooks/useVendas';
import { brl, comissaoPorVendedor, isComissionavel } from '@/lib/vendas/skywork';

const tick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const kFmt = (v: number) => `${Math.round(v / 1000)}k`;
const mesLabel = (m: string) => { const [y, mm] = m.split('-'); return `${mm}/${y}`; };
const CORES = ['hsl(var(--primary))', 'hsl(var(--chart-2, 160 60% 45%))', 'hsl(var(--chart-3, 30 80% 55%))', 'hsl(var(--chart-4, 280 65% 60%))', 'hsl(var(--chart-5, 340 75% 55%))', 'hsl(var(--muted-foreground))'];

export function VendasDashboard({ vendas, historico }: { vendas: Venda[]; historico: Venda[] }) {
  const { data: itensMap } = useTodosItens();
  const [vendMes, setVendMes] = useState('all');
  const concl = useMemo(() => vendas.filter(v => v.situacao === 'Concluído'), [vendas]);
  const conclHist = useMemo(() => historico.filter(v => v.situacao === 'Concluído' && v.data_venda), [historico]);

  const stats = useMemo(() => {
    const total = concl.reduce((s, v) => s + v.valor, 0);
    const comissao = concl.filter(isComissionavel).flatMap(v => comissaoPorVendedor(v, itensMap?.get(v.id))).reduce((s, c) => s + c.comissao, 0);
    return { total, qtd: concl.length, comissao, ticket: concl.length ? total / concl.length : 0 };
  }, [concl, itensMap]);

  const agrupar = (key: (v: Venda) => string) => {
    const m = new Map<string, number>();
    concl.forEach(v => m.set(key(v), (m.get(key(v)) || 0) + v.valor));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  };
  const porVendedor = agrupar(v => v.vendedor || '—');
  const porEmitente = agrupar(v => v.emitente_nome || v.emitente_cnpj);

  const porServico = useMemo(() => {
    const m = new Map<string, { value: number; qtd: number }>();
    concl.forEach(v => (itensMap?.get(v.id) || []).forEach(i => {
      const n = (i.nome || 'Sem nome').trim();
      const r = m.get(n) || { value: 0, qtd: 0 };
      r.value += Number(i.valor_total) || 0; r.qtd += Number(i.quantidade) || 1;
      m.set(n, r);
    }));
    return Array.from(m.entries()).map(([name, r]) => ({ name, value: Math.round(r.value * 100) / 100, qtd: r.qtd })).sort((a, b) => b.value - a.value).slice(0, 15);
  }, [concl, itensMap]);

  const vendedores = useMemo(() => Array.from(new Set(conclHist.map(v => v.vendedor!))).sort(), [conclHist]);

  // Mês a mês (histórico completo, últimos 12 meses com dados)
  const mensal = useMemo(() => {
    const meses = Array.from(new Set(conclHist.map(v => v.data_venda!.slice(0, 7)))).sort().slice(-12);
    const top = vendMes === 'all' ? porVendedorHist(conclHist).slice(0, 5) : [vendMes];
    const rows = meses.map(m => {
      const doMes = conclHist.filter(v => v.data_venda!.startsWith(m));
      const row: Record<string, any> = { mes: mesLabel(m), Geral: 0 };
      doMes.forEach(v => {
        row.Geral += v.valor;
        const k = top.includes(v.vendedor!) ? v.vendedor! : 'Outros';
        row[k] = (row[k] || 0) + v.valor;
      });
      return row;
    });
    const series = vendMes === 'all' ? [...top, 'Outros'] : top;
    return { rows, series };
  }, [conclHist, vendMes]);

  const Grafico = ({ data }: { data: { name: string; value: number }[] }) => (
    <div className="h-[320px]">
      {data.length === 0 ? <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados</div> : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 30, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={tick} tickFormatter={kFmt} />
            <YAxis type="category" dataKey="name" width={160} tick={tick} />
            <Tooltip formatter={(v: number) => [brl(v), 'Faturado']} />
            <Bar dataKey="value" name="Faturado" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OSKPICard title="Faturado (concluídas)" value={brl(stats.total)} subtitle="Fatura e NFS-e emitidas" icon={DollarSign} variant="primary" />
        <OSKPICard title="Vendas concluídas" value={stats.qtd} icon={Receipt} variant="success" />
        <OSKPICard title="Ticket médio" value={brl(stats.ticket)} icon={TrendingUp} />
        <OSKPICard title="Comissões previstas" value={brl(stats.comissao)} subtitle="Sem Faturamento" icon={Percent} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">Faturado mês a mês</CardTitle>
          <Select value={vendMes} onValueChange={setVendMes}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Geral (top 5 vendedores)</SelectItem>
              {vendedores.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[340px]">
            {mensal.rows.length === 0 ? <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mensal.rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={tick} />
                  <YAxis tick={tick} tickFormatter={kFmt} />
                  <Tooltip formatter={(v: number, n: string) => [brl(v), n]} />
                  <Legend />
                  {mensal.series.map((s, i) => <Bar key={s} dataKey={s} name={s} stackId="a" fill={CORES[i % CORES.length]} />)}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Últimos 12 meses com vendas concluídas (não depende do filtro de mês).</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-lg">Faturado por vendedor</CardTitle></CardHeader><CardContent><Grafico data={porVendedor} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Faturado por emitente</CardTitle></CardHeader><CardContent><Grafico data={porEmitente} /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-lg">Faturado por serviço (top 15)</CardTitle></CardHeader><CardContent><Grafico data={porServico} /></CardContent></Card>
    </div>
  );
}

function porVendedorHist(vs: Venda[]) {
  const m = new Map<string, number>();
  vs.forEach(v => m.set(v.vendedor!, (m.get(v.vendedor!) || 0) + v.valor));
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
}
