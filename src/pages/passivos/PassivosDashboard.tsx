import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePassivos } from '@/hooks/usePassivos';
import { brl, formatCnpj, STATUS_LABELS, getRiskLevel, RISK_THRESHOLDS } from '@/lib/passivos/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle, CheckCircle2, FileWarning, Wallet, Layers, ShieldAlert,
  Calendar, TrendingDown, Building2, PieChart as PieIcon,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';

const MES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fmtMonth = (d: Date) => `${MES_LABEL[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;

const RISK_COLORS = {
  ok: 'hsl(142 71% 45%)',
  atencao: 'hsl(38 92% 50%)',
  critico: 'hsl(0 84% 60%)',
};

export default function PassivosDashboard() {
  const { data: rows = [], isLoading } = usePassivos();

  const ativos = useMemo(() => rows.filter(r => r.status !== 'encerrado'), [rows]);

  const stats = useMemo(() => {
    const valorMensal = ativos.reduce((s, r) => s + Number(r.valor_mensal || 0), 0);
    const totalProjetado = ativos.reduce((s, r) => s + Number(r.valor_mensal || 0) * (r.parcelas_restantes || 0), 0);
    const totalAtrasoMonetario = ativos.reduce((s, r) => s + Number(r.valor_mensal || 0) * (r.parcelas_em_atraso || 0), 0);
    const parcelasRestantes = ativos.reduce((s, r) => s + (r.parcelas_restantes || 0), 0);
    const parcelasPagas = ativos.reduce((s, r) => s + (r.parcelas_pagas || 0), 0);
    const parcelasTotais = ativos.reduce((s, r) => s + (r.parcelas_totais || 0), 0);
    const cnpjs = new Set(ativos.map(r => r.cnpj)).size;
    const criticos = ativos.filter(r => getRiskLevel(r.parcelas_em_atraso) === 'critico').length;
    const atencao = ativos.filter(r => getRiskLevel(r.parcelas_em_atraso) === 'atencao').length;
    const regulares = ativos.length - criticos - atencao;
    const proxEncerr = ativos.filter(r => (r.parcelas_restantes || 0) > 0 && (r.parcelas_restantes || 0) <= 12).length;
    const progressoGeral = parcelasTotais > 0 ? (parcelasPagas / parcelasTotais) * 100 : 0;
    return {
      ativos: ativos.length, valorMensal, totalProjetado, totalAtrasoMonetario,
      parcelasRestantes, parcelasPagas, parcelasTotais, cnpjs, criticos, atencao,
      regulares, proxEncerr, progressoGeral,
    };
  }, [ativos]);

  // Projeção financeira 12 meses
  const projecao12 = useMemo(() => {
    const months = 12;
    const today = new Date();
    const out: { mes: string; valor: number; encerramentos: number }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      let valor = 0, encerramentos = 0;
      ativos.forEach(r => {
        const restantes = r.parcelas_restantes || 0;
        if (restantes <= 0) return;
        if (i < restantes) valor += Number(r.valor_mensal || 0);
        if (i === restantes - 1) encerramentos += 1;
      });
      out.push({ mes: fmtMonth(d), valor, encerramentos });
    }
    return out;
  }, [ativos]);

  // Distribuição por tipo
  const porTipo = useMemo(() => {
    const map = new Map<string, { tipo: string; quantidade: number; mensal: number; projetado: number }>();
    ativos.forEach(r => {
      const e = map.get(r.tipo_parcelamento) ?? { tipo: r.tipo_parcelamento, quantidade: 0, mensal: 0, projetado: 0 };
      e.quantidade += 1;
      e.mensal += Number(r.valor_mensal || 0);
      e.projetado += Number(r.valor_mensal || 0) * (r.parcelas_restantes || 0);
      map.set(r.tipo_parcelamento, e);
    });
    return Array.from(map.values()).sort((a, b) => b.projetado - a.projetado);
  }, [ativos]);

  // Top CNPJs por exposição (projetado)
  const topCnpj = useMemo(() => {
    const map = new Map<string, { cnpj: string; empresa: string; ativos: number; atraso: number; mensal: number; projetado: number }>();
    ativos.forEach(r => {
      const e = map.get(r.cnpj) ?? { cnpj: r.cnpj, empresa: r.empresa_nome, ativos: 0, atraso: 0, mensal: 0, projetado: 0 };
      e.ativos += 1;
      e.mensal += Number(r.valor_mensal || 0);
      e.projetado += Number(r.valor_mensal || 0) * (r.parcelas_restantes || 0);
      e.atraso += r.parcelas_em_atraso || 0;
      map.set(r.cnpj, e);
    });
    return Array.from(map.values()).sort((a, b) => b.projetado - a.projetado);
  }, [ativos]);

  const riskPie = [
    { name: 'Regular', value: stats.regulares, color: RISK_COLORS.ok },
    { name: 'Atenção', value: stats.atencao, color: RISK_COLORS.atencao },
    { name: 'Crítico', value: stats.criticos, color: RISK_COLORS.critico },
  ];

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      {/* Banner executivo */}
      {(stats.criticos > 0 || stats.totalAtrasoMonetario > 0) && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Exposição imediata: {brl(stats.totalAtrasoMonetario)} em parcelas atrasadas</AlertTitle>
          <AlertDescription>
            {stats.criticos} parcelamento(s) crítico(s) (≥{RISK_THRESHOLDS.critico} parcelas em atraso) e {stats.atencao} em atenção.
            Risco direto de rescisão e cobrança integral do saldo.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs estratégicos */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Wallet className="h-5 w-5" />}
          label="Saída mensal recorrente"
          value={brl(stats.valorMensal)}
          sub={`${stats.ativos} parcelamentos · ${stats.cnpjs} CNPJs`}
        />
        <Kpi
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Saldo devedor projetado"
          value={brl(stats.totalProjetado)}
          sub={`${stats.parcelasRestantes} parcelas restantes`}
        />
        <Kpi
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Exposição em atraso"
          value={brl(stats.totalAtrasoMonetario)}
          sub={`${stats.criticos + stats.atencao} em risco`}
          tone={stats.totalAtrasoMonetario > 0 ? 'danger' : 'ok'}
        />
        <Kpi
          icon={<Calendar className="h-5 w-5 text-blue-600" />}
          label="Encerram em até 12 meses"
          value={String(stats.proxEncerr)}
          sub="Alívio próximo de caixa"
        />
      </div>

      {/* Progresso global */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" /> Progresso global dos parcelamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">{stats.parcelasPagas} de {stats.parcelasTotais} parcelas pagas</span>
            <span className="font-semibold tabular-nums">{stats.progressoGeral.toFixed(1)}%</span>
          </div>
          <Progress value={stats.progressoGeral} className="h-2" />
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Projeção de saída mensal (12 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projecao12} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <RTooltip formatter={(v: number) => brl(v)} />
                  <Bar dataKey="valor" name="Saída mensal" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="h-4 w-4" /> Distribuição por risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {riskPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Top exposição por CNPJ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead className="text-right">Mensal</TableHead>
                  <TableHead className="text-right">Projetado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCnpj.slice(0, 8).map(r => (
                  <TableRow key={r.cnpj}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.empresa}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{formatCnpj(r.cnpj)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.ativos}
                      {r.atraso > 0 && <div className="text-[10px] text-red-600">{r.atraso} atraso</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(r.mensal)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{brl(r.projetado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileWarning className="h-4 w-4" /> Composição por tipo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Mensal</TableHead>
                  <TableHead className="text-right">Projetado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porTipo.map(r => (
                  <TableRow key={r.tipo}>
                    <TableCell className="font-medium">{r.tipo}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.quantidade}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(r.mensal)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{brl(r.projetado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(STATUS_LABELS).map(([k, v]) => {
              const count = rows.filter(r => r.status === k).length;
              return (
                <div key={k} className="px-3 py-1.5 rounded-md border bg-muted/30">
                  <span className="text-muted-foreground">{v}: </span>
                  <span className="font-semibold">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon, label, value, sub, tone,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'danger' | 'ok' }) {
  return (
    <Card className={tone === 'danger' ? 'border-red-200 bg-red-50/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <div className={`mt-1 text-2xl font-bold tabular-nums ${tone === 'danger' ? 'text-red-700' : ''}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
