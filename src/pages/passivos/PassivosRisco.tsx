import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ShieldAlert, TrendingDown } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import { usePassivos, type Passivo } from '@/hooks/usePassivos';
import {
  brl, formatCnpj, getRiskLevel, RISK_BADGE, RISK_LABEL,
  RISK_THRESHOLDS, STATUS_LABELS,
} from '@/lib/passivos/utils';

const MES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtMonth(d: Date) {
  return `${MES_LABEL[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

export default function PassivosRisco() {
  const { data: rows = [], isLoading } = usePassivos();

  const ativos = useMemo(() => rows.filter(r => r.status !== 'encerrado'), [rows]);

  const criticos = useMemo(
    () => ativos
      .map(r => ({ r, risk: getRiskLevel(r.parcelas_em_atraso) }))
      .filter(x => x.risk !== 'ok')
      .sort((a, b) => b.r.parcelas_em_atraso - a.r.parcelas_em_atraso),
    [ativos]
  );

  const riskCounts = useMemo(() => {
    const c = { ok: 0, atencao: 0, critico: 0 };
    ativos.forEach(r => { c[getRiskLevel(r.parcelas_em_atraso)]++; });
    return c;
  }, [ativos]);

  // Projeção mensal: para cada um dos próximos 24 meses, somar valor_mensal
  // de parcelamentos cujas parcelas restantes alcançam aquele mês.
  const projecao = useMemo(() => {
    const months = 24;
    const today = new Date();
    const out: { mes: string; valor: number; encerramentos: number }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      let valor = 0;
      let encerramentos = 0;
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

  // Indicadores de risco por CNPJ
  const porCnpj = useMemo(() => {
    const map = new Map<string, {
      cnpj: string; empresa: string; ativos: number; atraso: number;
      criticos: number; mensal: number; maxAtraso: number;
    }>();
    ativos.forEach(r => {
      const entry = map.get(r.cnpj) ?? {
        cnpj: r.cnpj, empresa: r.empresa_nome,
        ativos: 0, atraso: 0, criticos: 0, mensal: 0, maxAtraso: 0,
      };
      entry.ativos += 1;
      entry.mensal += Number(r.valor_mensal || 0);
      entry.atraso += r.parcelas_em_atraso || 0;
      entry.maxAtraso = Math.max(entry.maxAtraso, r.parcelas_em_atraso || 0);
      if (getRiskLevel(r.parcelas_em_atraso) === 'critico') entry.criticos += 1;
      map.set(r.cnpj, entry);
    });
    return Array.from(map.values())
      .sort((a, b) => b.maxAtraso - a.maxAtraso || b.atraso - a.atraso);
  }, [ativos]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      {riskCounts.critico > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Risco de cancelamento de parcelamento</AlertTitle>
          <AlertDescription>
            {riskCounts.critico} parcelamento(s) com {RISK_THRESHOLDS.cancelamento}+ parcelas em atraso —
            ação imediata recomendada para evitar rescisão.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <RiskKpi label="Regulares" value={riskCounts.ok} tone="ok" />
        <RiskKpi label={`Atenção (≥${RISK_THRESHOLDS.atencao})`} value={riskCounts.atencao} tone="atencao" />
        <RiskKpi label={`Crítico (≥${RISK_THRESHOLDS.critico})`} value={riskCounts.critico} tone="critico" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Projeção financeira mensal (24 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projecao} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <RTooltip formatter={(v: number) => brl(v)} />
                  <Line type="monotone" dataKey="valor" name="Saída mensal" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projeção de encerramento de parcelamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projecao} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend />
                  <Bar dataKey="encerramentos" name="Encerramentos" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Indicadores de risco por CNPJ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CNPJ</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Críticos</TableHead>
                <TableHead className="text-right">Parc. em atraso</TableHead>
                <TableHead className="text-right">Pior atraso</TableHead>
                <TableHead className="text-right">Vol. mensal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCnpj.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem parcelamentos ativos.</TableCell></TableRow>
              )}
              {porCnpj.map(r => {
                const risk = getRiskLevel(r.maxAtraso);
                return (
                  <TableRow key={r.cnpj}>
                    <TableCell className="font-mono text-xs">{formatCnpj(r.cnpj)}</TableCell>
                    <TableCell className="font-medium">{r.empresa}</TableCell>
                    <TableCell className="text-right">{r.ativos}</TableCell>
                    <TableCell className={`text-right ${r.criticos > 0 ? 'text-red-600 font-semibold' : ''}`}>{r.criticos}</TableCell>
                    <TableCell className="text-right">{r.atraso}</TableCell>
                    <TableCell className="text-right">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] ${RISK_BADGE[risk]}`}>
                        {r.maxAtraso} · {RISK_LABEL[risk]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(r.mensal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600" /> Parcelamentos críticos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CNPJ</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Acordo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Atraso</TableHead>
                <TableHead className="text-right">Restantes</TableHead>
                <TableHead className="text-right">Valor mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criticos.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhum parcelamento em risco. 🎉</TableCell></TableRow>
              )}
              {criticos.map(({ r, risk }: { r: Passivo; risk: 'atencao' | 'critico' | 'ok' }) => (
                <TableRow key={r.id} className={risk === 'critico' ? 'bg-red-50' : 'bg-amber-50'}>
                  <TableCell className="font-mono text-xs">{formatCnpj(r.cnpj)}</TableCell>
                  <TableCell className="font-medium">{r.empresa_nome}</TableCell>
                  <TableCell>{r.numero_acordo}</TableCell>
                  <TableCell>{r.tipo_parcelamento}</TableCell>
                  <TableCell className="text-right font-semibold text-red-700">{r.parcelas_em_atraso}</TableCell>
                  <TableCell className="text-right">{r.parcelas_restantes}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.valor_mensal)}</TableCell>
                  <TableCell className="text-xs">{STATUS_LABELS[r.status]}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] ${RISK_BADGE[risk]}`}>
                      {RISK_LABEL[risk]}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskKpi({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'atencao' | 'critico' }) {
  const colors = {
    ok: 'text-emerald-700 border-emerald-200 bg-emerald-50',
    atencao: 'text-amber-800 border-amber-200 bg-amber-50',
    critico: 'text-red-700 border-red-200 bg-red-50',
  } as const;
  return (
    <Card className={`border ${colors[tone]}`}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide">{label}</div>
        <div className="mt-1 text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
