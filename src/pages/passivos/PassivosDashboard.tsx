import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePassivos } from '@/hooks/usePassivos';
import { brl, formatCnpj, STATUS_LABELS } from '@/lib/passivos/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, FileWarning, Wallet, Layers } from 'lucide-react';

export default function PassivosDashboard() {
  const { data: rows = [], isLoading } = usePassivos();

  const stats = useMemo(() => {
    const ativos = rows.filter(r => r.status !== 'encerrado');
    const valorMensal = ativos.reduce((s, r) => s + Number(r.valor_mensal || 0), 0);
    const atraso = ativos.filter(r => r.status === 'atrasado' || r.parcelas_em_atraso > 0);
    const totalProjetado = ativos.reduce((s, r) => s + Number(r.valor_mensal || 0) * (r.parcelas_restantes || 0), 0);
    const parcelasRestantes = ativos.reduce((s, r) => s + (r.parcelas_restantes || 0), 0);
    return {
      ativos: ativos.length,
      atraso: atraso.length,
      valorMensal,
      totalProjetado,
      parcelasRestantes,
    };
  }, [rows]);

  const porCnpj = useMemo(() => {
    const map = new Map<string, { cnpj: string; empresa: string; ativos: number; atraso: number; mensal: number; restante: number }>();
    rows.forEach(r => {
      const k = r.cnpj;
      const entry = map.get(k) ?? { cnpj: r.cnpj, empresa: r.empresa_nome, ativos: 0, atraso: 0, mensal: 0, restante: 0 };
      if (r.status !== 'encerrado') {
        entry.ativos += 1;
        entry.mensal += Number(r.valor_mensal || 0);
        entry.restante += Number(r.valor_mensal || 0) * (r.parcelas_restantes || 0);
        if (r.status === 'atrasado' || r.parcelas_em_atraso > 0) entry.atraso += 1;
      }
      map.set(k, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.mensal - a.mensal);
  }, [rows]);

  const porStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [rows]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={<Layers className="h-4 w-4" />} label="Parcelamentos ativos" value={String(stats.ativos)} />
        <Kpi icon={<AlertTriangle className="h-4 w-4 text-red-600" />} label="Em atraso" value={String(stats.atraso)} tone="danger" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Volume mensal" value={brl(stats.valorMensal)} />
        <Kpi icon={<FileWarning className="h-4 w-4" />} label="Parcelas restantes" value={String(stats.parcelasRestantes)} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Total projetado" value={brl(stats.totalProjetado)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <div key={k} className="px-3 py-1.5 rounded-md border bg-muted/30">
                <span className="text-muted-foreground">{v}: </span>
                <span className="font-semibold">{porStatus[k] || 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Consolidado por CNPJ</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CNPJ</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Em atraso</TableHead>
                <TableHead className="text-right">Volume mensal</TableHead>
                <TableHead className="text-right">Total projetado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCnpj.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum parcelamento cadastrado.</TableCell></TableRow>
              )}
              {porCnpj.map(r => (
                <TableRow key={r.cnpj}>
                  <TableCell className="font-mono text-xs">{formatCnpj(r.cnpj)}</TableCell>
                  <TableCell className="font-medium">{r.empresa}</TableCell>
                  <TableCell className="text-right">{r.ativos}</TableCell>
                  <TableCell className={`text-right ${r.atraso > 0 ? 'text-red-600 font-semibold' : ''}`}>{r.atraso}</TableCell>
                  <TableCell className="text-right">{brl(r.mensal)}</TableCell>
                  <TableCell className="text-right">{brl(r.restante)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'danger' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <div className={`mt-1 text-2xl font-bold ${tone === 'danger' ? 'text-red-600' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
