import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ShieldAlert, TrendingDown, Calculator, Sparkles } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
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

  // ===== Simulador de regularização =====
  // Premissa: pagar X parcela(s) extra por mês nos parcelamentos com atraso (atenção + crítico)
  // até zerar o atraso de cada um.
  const [extrasPerMonth, setExtrasPerMonth] = useState(1);

  const sim = useMemo(() => {
    const alvos = ativos
      .filter(r => r.parcelas_em_atraso > 0)
      .map(r => ({
        id: r.id,
        empresa: r.empresa_nome,
        acordo: r.numero_acordo,
        valor: Number(r.valor_mensal || 0),
        atrasoInicial: r.parcelas_em_atraso,
        risk: getRiskLevel(r.parcelas_em_atraso),
      }));

    const maxAtraso = alvos.reduce((m, a) => Math.max(m, a.atrasoInicial), 0);
    const mesesParaRegularizar = extrasPerMonth > 0 ? Math.ceil(maxAtraso / extrasPerMonth) : 0;
    const horizon = Math.max(mesesParaRegularizar, 1);

    const today = new Date();
    const remaining = new Map(alvos.map(a => [a.id, a.atrasoInicial]));
    const series: { mes: string; baseline: number; comAcao: number; extra: number; regularizados: number }[] = [];
    let totalExtra = 0;
    let totalRegularizadosAcum = 0;

    for (let i = 0; i < horizon; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      let baseline = 0, comAcao = 0, extra = 0, regularizadosMes = 0;
      alvos.forEach(a => {
        const rem = remaining.get(a.id) ?? 0;
        if (rem <= 0) return;
        // Cenário sem ação: paga apenas 1 parcela/mês (acumula sem reduzir atraso)
        baseline += a.valor;
        // Cenário com ação: paga 1 (do mês corrente) + extras (até zerar atraso)
        const pagasExtras = Math.min(extrasPerMonth, rem);
        const totalPagasNoMes = 1 + pagasExtras;
        comAcao += a.valor * totalPagasNoMes;
        extra += a.valor * pagasExtras;
        const novoRem = Math.max(0, rem - extrasPerMonth);
        if (novoRem === 0 && rem > 0) regularizadosMes += 1;
        remaining.set(a.id, novoRem);
      });
      totalExtra += extra;
      totalRegularizadosAcum += regularizadosMes;
      series.push({
        mes: `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        baseline, comAcao, extra,
        regularizados: totalRegularizadosAcum,
      });
    }

    return {
      alvos, maxAtraso, mesesParaRegularizar, series, totalExtra,
      totalAtrasados: alvos.length,
      totalParcelasAtraso: alvos.reduce((s, a) => s + a.atrasoInicial, 0),
    };
  }, [ativos, extrasPerMonth]);

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

      {/* Simulador de regularização */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Simulador de regularização
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Compara o que a empresa <strong>pagará todo mês</strong> mantendo o ritmo atual (apenas a parcela do mês,
            sem reduzir o atraso) versus <strong>antecipar parcelas atrasadas</strong> para sair da zona de risco.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sim.totalAtrasados === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nenhum parcelamento em atraso para regularizar. 🎉
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <SimStat label="Parcelamentos em atraso" value={String(sim.totalAtrasados)} />
                <SimStat label="Parcelas atrasadas (soma)" value={String(sim.totalParcelasAtraso)} />
                <SimStat label="Meses até regularizar tudo" value={`${sim.mesesParaRegularizar}`} highlight />
                <SimStat label="Desembolso extra total" value={brl(sim.totalExtra)} />
              </div>

              <div className="rounded-md border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Parcelas extras pagas por mês em cada acordo atrasado
                  </Label>
                  <span className="text-lg font-bold tabular-nums">+{extrasPerMonth}</span>
                </div>
                <Slider
                  value={[extrasPerMonth]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(v) => setExtrasPerMonth(v[0])}
                />
                <p className="text-xs text-muted-foreground">
                  Cenário: em cada acordo em atraso, pagar a parcela do mês <strong>+ {extrasPerMonth}</strong> parcela(s)
                  atrasada(s), até zerar o atraso. Pior caso atual ({sim.maxAtraso} parcelas atrasadas)
                  ficará em dia em <strong>{sim.mesesParaRegularizar} mês(es)</strong>.
                </p>
              </div>

              {/* Legenda explicativa */}
              <div className="rounded-md border bg-blue-50/50 border-blue-200 p-3 text-xs space-y-1.5">
                <div className="font-semibold text-blue-900 mb-1">Como ler os números abaixo</div>
                <div><span className="inline-block w-3 h-3 rounded-sm bg-muted-foreground/40 mr-2 align-middle" /><strong>Saída sem ação:</strong> valor que sairá do caixa mantendo o pagamento atual (1 parcela/mês por acordo). O atraso <em>não diminui</em>.</div>
                <div><span className="inline-block w-3 h-3 rounded-sm bg-primary mr-2 align-middle" /><strong>Saída com regularização:</strong> valor que sairá do caixa pagando a parcela do mês <em>+ as extras</em> de cada acordo atrasado.</div>
                <div><span className="text-amber-700 font-semibold">Extra no mês:</span> diferença entre os dois cenários — quanto a empresa precisa desembolsar a mais naquele mês para colocar os acordos em dia.</div>
                <div><span className="text-emerald-700 font-semibold">Regularizados acum.:</span> quantos acordos já saíram do atraso até aquele mês. Quando atinge {sim.totalAtrasados}, todos os parcelamentos estão em dia.</div>
                <div className="pt-1 text-blue-900">Quando o esforço termina, a saída mensal volta ao valor normal (apenas a parcela corrente de cada acordo).</div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sim.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RTooltip formatter={(v: number, n: string) => n === 'Regularizados (acum.)' ? v : brl(v)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="baseline" name="Pagamento normal (sem ação)" fill="hsl(var(--muted-foreground) / 0.4)" />
                    <Bar yAxisId="left" dataKey="comAcao" name="Com regularização" fill="hsl(var(--primary))" />
                    <Line yAxisId="right" type="monotone" dataKey="regularizados" name="Regularizados (acum.)" stroke="hsl(142 71% 45%)" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Saída sem ação</TableHead>
                      <TableHead className="text-right">Saída com regularização</TableHead>
                      <TableHead className="text-right">Extra no mês</TableHead>
                      <TableHead className="text-right">Regularizados acum.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sim.series.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{m.mes}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{brl(m.baseline)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{brl(m.comAcao)}</TableCell>
                        <TableCell className="text-right tabular-nums text-amber-700">{brl(m.extra)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-700">{m.regularizados}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Plano de ação recomendado */}
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <ShieldAlert className="h-4 w-4" /> Plano de ação recomendado para a diretoria
                </div>
                <ol className="text-xs space-y-2 list-decimal pl-5 text-foreground/90">
                  <li>
                    <strong>Reservar caixa de {brl(sim.series[0]?.comAcao ?? 0)}</strong> no primeiro mês de execução
                    (saída total com regularização) e {brl(sim.totalExtra)} acumulados ao longo de {sim.mesesParaRegularizar} mês(es).
                  </li>
                  <li>
                    <strong>Priorizar os {sim.alvos.filter(a => a.risk === 'critico').length} acordo(s) críticos</strong>{' '}
                    (3+ parcelas em atraso) — são os que correm risco de <em>rescisão</em> pelo órgão e perda do parcelamento.
                  </li>
                  <li>
                    Pagar <strong>{extrasPerMonth} parcela(s) extra por mês</strong> em cada acordo em atraso, junto com a parcela corrente,
                    até zerar o atraso. Depois desse período, a saída mensal volta ao patamar normal.
                  </li>
                  <li>
                    Após regularização, monitorar mensalmente nesta tela para evitar reincidência — qualquer acordo que volte
                    a 2 parcelas em atraso já entra em <span className="text-amber-700 font-semibold">Atenção</span>.
                  </li>
                  <li>
                    Se o caixa não comportar +{extrasPerMonth} parcela(s) por mês em todos os acordos, reduzir o slider para{' '}
                    <strong>+1</strong> e concentrar o esforço apenas nos críticos, renegociando os demais com o órgão.
                  </li>
                </ol>

                {sim.alvos.filter(a => a.risk === 'critico').length > 0 && (
                  <div className="pt-2 border-t border-primary/20">
                    <div className="text-xs font-semibold mb-1.5 text-primary">Acordos críticos para atacar primeiro:</div>
                    <ul className="text-xs space-y-1">
                      {sim.alvos
                        .filter(a => a.risk === 'critico')
                        .sort((a, b) => b.atrasoInicial - a.atrasoInicial)
                        .slice(0, 5)
                        .map(a => (
                          <li key={a.id} className="flex justify-between gap-2 border-b border-primary/10 pb-1">
                            <span className="truncate"><strong>{a.empresa}</strong> · acordo {a.acordo}</span>
                            <span className="tabular-nums whitespace-nowrap text-red-700 font-semibold">
                              {a.atrasoInicial} atrasadas · {brl(a.valor * a.atrasoInicial)} para zerar
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>



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
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] ${RISK_BADGE[risk]} whitespace-nowrap`}>
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
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] ${RISK_BADGE[risk]} whitespace-nowrap`}>
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

function SimStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? 'border-primary/40 bg-primary/5' : 'bg-muted/30'}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${highlight ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}
