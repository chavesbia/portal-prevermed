import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSignature, AlertTriangle, XCircle, DollarSign, Clock } from 'lucide-react';
import { formatBRL, formatDateBR, formatCNPJ } from '@/lib/contractual/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  rascunho: { label: 'Rascunho', tone: 'bg-slate-100 text-slate-700' },
  aguardando_assinatura: { label: 'Aguardando assinatura', tone: 'bg-amber-100 text-amber-800' },
  parcialmente_assinado: { label: 'Parc. assinado', tone: 'bg-amber-100 text-amber-800' },
  assinado: { label: 'Assinado', tone: 'bg-emerald-100 text-emerald-800' },
  ativo: { label: 'Ativo', tone: 'bg-emerald-100 text-emerald-800' },
  vencendo_60: { label: 'Vence em 60d', tone: 'bg-yellow-100 text-yellow-800' },
  vencendo_30: { label: 'Vence em 30d', tone: 'bg-orange-100 text-orange-800' },
  vencendo_15: { label: 'Vence em 15d', tone: 'bg-red-100 text-red-700' },
  vencido: { label: 'Vencido', tone: 'bg-red-100 text-red-800' },
  encerrado: { label: 'Encerrado', tone: 'bg-slate-200 text-slate-700' },
  cancelado: { label: 'Cancelado', tone: 'bg-slate-200 text-slate-700' },
};

export default function ContratualDashboard() {
  const [filter, setFilter] = useState<string>('todos');

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contract-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_contratos')
        .select('id, numero_contrato, status, data_inicio, data_fim, valor_mensal, cliente:contract_clientes(razao_social, cnpj)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const cards = {
    ativos: contratos.filter((c: any) => ['ativo', 'vencendo_60', 'vencendo_30', 'vencendo_15', 'assinado'].includes(c.status)).length,
    aguardando: contratos.filter((c: any) => ['aguardando_assinatura', 'parcialmente_assinado'].includes(c.status)).length,
    vencendo: contratos.filter((c: any) => ['vencendo_30', 'vencendo_15'].includes(c.status)).length,
    vencidos: contratos.filter((c: any) => c.status === 'vencido').length,
    encerrados: contratos.filter((c: any) => c.status === 'encerrado').length,
    valorTotal: contratos
      .filter((c: any) => ['ativo', 'vencendo_60', 'vencendo_30', 'vencendo_15', 'assinado'].includes(c.status))
      .reduce((acc: number, c: any) => acc + Number(c.valor_mensal || 0), 0),
  };

  const filtered = contratos.filter((c: any) => {
    if (filter === 'todos') return true;
    if (filter === 'ativo') return ['ativo', 'vencendo_60', 'vencendo_30', 'vencendo_15'].includes(c.status);
    if (filter === 'assinado') return c.status === 'assinado';
    if (filter === 'pendente') return ['rascunho', 'aguardando_assinatura', 'parcialmente_assinado'].includes(c.status);
    if (filter === 'vencido') return c.status === 'vencido';
    if (filter === 'encerrado') return c.status === 'encerrado';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={<FileText className="h-4 w-4" />} label="Ativos" value={cards.ativos} tone="text-emerald-700" />
        <KpiCard icon={<FileSignature className="h-4 w-4" />} label="Aguardando" value={cards.aguardando} tone="text-amber-700" />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Vence em 30d" value={cards.vencendo} tone="text-orange-700" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Vencidos" value={cards.vencidos} tone="text-red-700" />
        <KpiCard icon={<XCircle className="h-4 w-4" />} label="Encerrados" value={cards.encerrados} tone="text-slate-600" />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Valor mensal" value={formatBRL(cards.valorTotal)} tone="text-primary" big />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Contratos</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="assinado">Assinados</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="vencido">Vencidos</SelectItem>
              <SelectItem value="encerrado">Encerrados</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Término</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum contrato encontrado.</TableCell></TableRow>
                )}
                {filtered.map((c: any) => {
                  const st = STATUS_LABEL[c.status] || { label: c.status, tone: 'bg-slate-100' };
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.numero_contrato}</TableCell>
                      <TableCell className="font-medium">{c.cliente?.razao_social}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCNPJ(c.cliente?.cnpj)}</TableCell>
                      <TableCell><Badge variant="secondary" className={st.tone}>{st.label}</Badge></TableCell>
                      <TableCell>{formatDateBR(c.data_inicio)}</TableCell>
                      <TableCell>{formatDateBR(c.data_fim)}</TableCell>
                      <TableCell className="text-right">{formatBRL(c.valor_mensal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, tone, big }: { icon: React.ReactNode; label: string; value: any; tone?: string; big?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className={tone}>{icon}</span>
        </div>
        <div className={`font-semibold mt-1 ${big ? 'text-base' : 'text-2xl'} ${tone || ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
