import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Download, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { useOSFinanceiro } from '@/hooks/useOSFinanceiro';
import { OSFinanceiroRow, statusOSColors } from '@/types/os';
import { format, parseISO } from 'date-fns';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function toCSV(rows: OSFinanceiroRow[]): string {
  const headers = [
    'OS', 'Cliente', 'Status', 'Responsável', 'Data Registro',
    'Receita', 'Custo', 'Margem R$', 'Margem %', 'Orçamento estourado',
  ];
  const lines = rows.map(r => [
    r.numero_os, r.empresa_cliente, r.status_os, r.responsavel_atual,
    r.data_registro,
    (r.receita_prevista || 0).toFixed(2).replace('.', ','),
    r.custo_total.toFixed(2).replace('.', ','),
    r.margem_valor.toFixed(2).replace('.', ','),
    r.margem_percent !== null ? r.margem_percent.toFixed(2).replace('.', ',') : '',
    r.custo_estourado ? 'Sim' : 'Não',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  return [headers.join(';'), ...lines].join('\n');
}

export function OSFinanceiroView() {
  const { rows, isLoading } = useOSFinanceiro();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [somenteAlertas, setSomenteAlertas] = useState<string>('all');

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search) {
        const s = search.toLowerCase();
        if (!r.empresa_cliente.toLowerCase().includes(s) && !r.numero_os.includes(s)) return false;
      }
      if (status !== 'all' && r.status_os !== status) return false;
      if (somenteAlertas === 'negativa' && !(r.receita_prevista && r.receita_prevista > 0 && r.margem_valor < 0)) return false;
      if (somenteAlertas === 'estourado' && !r.custo_estourado) return false;
      return true;
    });
  }, [rows, search, status, somenteAlertas]);

  const totals = useMemo(() => {
    const receita = filtered.reduce((s, r) => s + (Number(r.receita_prevista) || 0), 0);
    const custo = filtered.reduce((s, r) => s + Number(r.custo_total || 0), 0);
    const margem = receita - custo;
    const margemPct = receita > 0 ? (margem / receita) * 100 : 0;
    const negativas = filtered.filter(r => r.receita_prevista && r.receita_prevista > 0 && r.margem_valor < 0).length;
    const estouradas = filtered.filter(r => r.custo_estourado).length;
    return { receita, custo, margem, margemPct, negativas, estouradas };
  }, [filtered]);

  const porResponsavel = useMemo(() => {
    const map = new Map<string, { receita: number; custo: number; qtd: number }>();
    filtered.forEach(r => {
      const key = r.responsavel_atual || '—';
      const cur = map.get(key) || { receita: 0, custo: 0, qtd: 0 };
      cur.receita += Number(r.receita_prevista) || 0;
      cur.custo += Number(r.custo_total) || 0;
      cur.qtd += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v, margem: v.receita - v.custo }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 10);
  }, [filtered]);

  const porCliente = useMemo(() => {
    const map = new Map<string, { receita: number; custo: number; qtd: number }>();
    filtered.forEach(r => {
      const key = r.empresa_cliente || '—';
      const cur = map.get(key) || { receita: 0, custo: 0, qtd: 0 };
      cur.receita += Number(r.receita_prevista) || 0;
      cur.custo += Number(r.custo_total) || 0;
      cur.qtd += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v, margem: v.receita - v.custo }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 10);
  }, [filtered]);

  const exportCSV = () => {
    const csv = toCSV(filtered);
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `os-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-12">Carregando dados financeiros...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" /> Receita prevista
          </div>
          <div className="text-xl font-semibold">{brl(totals.receita)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Custo total</div>
          <div className="text-xl font-semibold">{brl(totals.custo)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Margem</div>
          <div className={`text-xl font-semibold flex items-center gap-1 ${totals.margem < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {totals.margem < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {brl(totals.margem)}
            <span className="text-xs font-normal text-muted-foreground ml-1">({totals.margemPct.toFixed(1)}%)</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3" /> Alertas
          </div>
          <div className="text-sm mt-1 space-y-0.5">
            <div><span className="font-semibold text-red-600">{totals.negativas}</span> margem negativa</div>
            <div><span className="font-semibold text-amber-600">{totals.estouradas}</span> orçamento estourado</div>
          </div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cliente ou nº OS" />
          </div>
          <div className="w-40">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Não iniciado">Não iniciado</SelectItem>
                <SelectItem value="Em andamento">Em andamento</SelectItem>
                <SelectItem value="Encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <label className="text-xs text-muted-foreground">Alertas</label>
            <Select value={somenteAlertas} onValueChange={setSomenteAlertas}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as OS</SelectItem>
                <SelectItem value="negativa">Somente margem negativa</SelectItem>
                <SelectItem value="estourado">Somente orçamento estourado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-3">
          <div className="font-semibold mb-2 text-sm">Top 10 clientes por receita</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCliente.map(c => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right">{c.qtd}</TableCell>
                  <TableCell className="text-right">{brl(c.receita)}</TableCell>
                  <TableCell className={`text-right ${c.margem < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{brl(c.margem)}</TableCell>
                </TableRow>
              ))}
              {porCliente.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem dados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-3">
          <div className="font-semibold mb-2 text-sm">Top 10 responsáveis por receita</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porResponsavel.map(c => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right">{c.qtd}</TableCell>
                  <TableCell className="text-right">{brl(c.receita)}</TableCell>
                  <TableCell className={`text-right ${c.margem < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{brl(c.margem)}</TableCell>
                </TableRow>
              ))}
              {porResponsavel.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem dados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card className="p-3">
        <div className="font-semibold mb-2 text-sm">Detalhamento por OS ({filtered.length})</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Alerta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.ordem_id}>
                  <TableCell className="font-mono text-xs">{r.numero_os}</TableCell>
                  <TableCell>{r.empresa_cliente}</TableCell>
                  <TableCell>
                    <Badge className={statusOSColors[r.status_os]}>{r.status_os}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.data_registro ? format(parseISO(r.data_registro), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell className="text-right">{brl(Number(r.receita_prevista) || 0)}</TableCell>
                  <TableCell className="text-right">{brl(Number(r.custo_total) || 0)}</TableCell>
                  <TableCell className={`text-right ${r.margem_valor < 0 ? 'text-red-600' : ''}`}>{brl(Number(r.margem_valor) || 0)}</TableCell>
                  <TableCell className={`text-right ${r.margem_percent !== null && r.margem_percent < 0 ? 'text-red-600' : ''}`}>
                    {r.margem_percent !== null ? `${Number(r.margem_percent).toFixed(1)}%` : '—'}
                  </TableCell>
                  <TableCell>
                    {r.custo_estourado && (
                      <Badge variant="destructive" className="text-[10px]">Orçamento</Badge>
                    )}
                    {r.receita_prevista && Number(r.receita_prevista) > 0 && r.margem_valor < 0 && (
                      <Badge variant="destructive" className="text-[10px] ml-1">Margem</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma OS encontrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
