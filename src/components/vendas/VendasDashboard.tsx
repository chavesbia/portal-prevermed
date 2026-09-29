import { useMemo } from 'react';
import { DollarSign, Receipt, UserX, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OSKPICard } from '@/components/os/OSKPICard';
import { type Venda, useTodosItens } from '@/hooks/useVendas';
import { brl, comissaoPorVendedor, isComissionavel } from '@/lib/vendas/skywork';

export function VendasDashboard({ vendas }: { vendas: Venda[] }) {
  const { data: itensMap } = useTodosItens();
  const concl = useMemo(() => vendas.filter(v => v.situacao === 'Concluído'), [vendas]);

  const stats = useMemo(() => {
    const total = concl.reduce((s, v) => s + v.valor, 0);
    const semVend = concl.filter(v => !v.vendedor).length;
    const comissao = concl.filter(isComissionavel).flatMap(v => comissaoPorVendedor(v, itensMap?.get(v.id))).reduce((s, c) => s + c.comissao, 0);
    return { total, qtd: concl.length, semVend, comissao };
  }, [concl, itensMap]);

  const agrupar = (key: (v: Venda) => string) => {
    const m = new Map<string, number>();
    concl.forEach(v => m.set(key(v), (m.get(key(v)) || 0) + v.valor));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  };
  const porVendedor = agrupar(v => v.vendedor || 'Sem vendedor');
  const porEmitente = agrupar(v => v.emitente_cnpj);

  const Grafico = ({ data }: { data: { name: string; value: number }[] }) => (
    <div className="h-[320px]">
      {data.length === 0 ? <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados</div> : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 30, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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
        <OSKPICard title="Sem vendedor" value={stats.semVend} subtitle="Corrigir no Skywork" icon={UserX} variant="destructive" />
        <OSKPICard title="Comissões previstas" value={brl(stats.comissao)} subtitle="Exclui Faturamento" icon={Percent} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-lg">Faturado por vendedor</CardTitle></CardHeader><CardContent><Grafico data={porVendedor} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Faturado por CNPJ emitente</CardTitle></CardHeader><CardContent><Grafico data={porEmitente} /></CardContent></Card>
      </div>
    </div>
  );
}
