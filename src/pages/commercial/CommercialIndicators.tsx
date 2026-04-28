import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommercialClients } from '@/hooks/useCommercialClients';
import { computeClientStatus, statusLabels } from '@/lib/commercial-status';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line } from 'recharts';
import { Loader2 } from 'lucide-react';
import { format, parseISO, addMonths, startOfMonth, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function CommercialIndicators() {
  const { clients, isLoading } = useCommercialClients();

  const active = useMemo(() => clients.filter(c => c.is_active), [clients]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of active) {
      const s = computeClientStatus({ ...c, attachments_count: 0 });
      counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts).map(([k, v]) => ({ name: statusLabels[k as keyof typeof statusLabels], value: v }));
  }, [active]);

  const subgroupLives = useMemo(() => {
    const map: Record<string, { clients: number; lives: number }> = {};
    for (const c of active) {
      const sg = c.subgroup || 'Sem subgrupo';
      if (!map[sg]) map[sg] = { clients: 0, lives: 0 };
      map[sg].clients++;
      map[sg].lives += c.active_lives || 0;
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.lives - a.lives)
      .slice(0, 10);
  }, [active]);

  const riskData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of active) {
      const r = c.risk_grade || 'N/I';
      counts[r] = (counts[r] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [active]);

  const expirationData = useMemo(() => {
    const map: Record<string, number> = {};
    const today = startOfMonth(new Date());
    for (let i = 0; i < 12; i++) {
      const m = addMonths(today, i);
      map[format(m, 'MMM/yy', { locale: ptBR })] = 0;
    }
    for (const c of active) {
      if (!c.contract_end_date) continue;
      try {
        const d = parseISO(c.contract_end_date);
        if (!isValid(d)) continue;
        const key = format(startOfMonth(d), 'MMM/yy', { locale: ptBR });
        if (key in map) map[key]++;
      } catch {}
    }
    return Object.entries(map).map(([month, value]) => ({ month, value }));
  }, [active]);

  const reviewData = useMemo(() => {
    const reviewed = active.filter(c => c.revisado).length;
    const pending = active.length - reviewed;
    return [
      { name: 'Revisados', value: reviewed },
      { name: 'Pendentes', value: pending },
    ];
  }, [active]);

  const totals = useMemo(() => {
    const totalLives = active.reduce((acc, c) => acc + (c.active_lives || 0), 0);
    const withContract = active.filter(c => c.has_contract).length;
    const signed = active.filter(c => c.contract_signed).length;
    return { totalLives, withContract, signed, total: active.length };
  }, [active]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Clientes Ativos" value={totals.total} />
        <KPI label="Vidas Ativas (total)" value={totals.totalLives} />
        <KPI label="Com Contrato" value={totals.withContract} subtitle={`${active.length ? Math.round((totals.withContract / active.length) * 100) : 0}%`} />
        <KPI label="Contratos Assinados" value={totals.signed} subtitle={`${active.length ? Math.round((totals.signed / active.length) * 100) : 0}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Status dos Contratos</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Grau de Risco</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {riskData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Vidas Ativas por Subgrupo (Top 10)</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subgroupLives}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="lives" name="Vidas" fill="hsl(var(--primary))" />
              <Bar dataKey="clients" name="Clientes" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vencimentos nos Próximos 12 Meses</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={expirationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" name="Contratos vencendo" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Status de Revisão</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={reviewData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                <Cell fill="#10b981" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, subtitle }: { label: string; value: number; subtitle?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value.toLocaleString('pt-BR')}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
