import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommercialClients } from '@/hooks/useCommercialClients';
import { computeClientStatus, statusLabels, statusColors, type ClientStatus } from '@/lib/commercial-status';
import { Search, X, Eye, Check, Loader2 } from 'lucide-react';

interface Props {
  initialStatusFilter: ClientStatus | null;
  onClearStatusFilter: () => void;
  onViewClient: (id: string) => void;
  readOnly: boolean;
}

const allStatuses: ClientStatus[] = [
  'sem_contrato', 'contrato_nao_assinado', 'vencido', 'a_vencer',
  'renovacao_pendente', 'documentacao_incompleta', 'ok',
];

export default function CommercialList({ initialStatusFilter, onClearStatusFilter, onViewClient, readOnly }: Props) {
  const { clients, isLoading } = useCommercialClients();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all');
  const [subgroupFilter, setSubgroupFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  const subgroups = useMemo(() => [...new Set(clients.map(c => c.subgroup).filter(Boolean))].sort(), [clients]);
  const riskGrades = useMemo(() => [...new Set(clients.map(c => c.risk_grade).filter(Boolean))].sort(), [clients]);

  const filteredClients = useMemo(() => {
    return clients
      .filter(c => c.is_active)
      .map(c => ({ ...c, status_geral: computeClientStatus({ ...c, attachments_count: 0 }) }))
      .filter(c => {
        if (search) {
          const s = search.toLowerCase();
          if (
            !c.company_name.toLowerCase().includes(s) &&
            !(c.cnpj || '').toLowerCase().includes(s)
          ) return false;
        }
        if (statusFilter !== 'all' && c.status_geral !== statusFilter) return false;
        if (subgroupFilter !== 'all' && c.subgroup !== subgroupFilter) return false;
        if (riskFilter !== 'all' && c.risk_grade !== riskFilter) return false;
        return true;
      });
  }, [clients, search, statusFilter, subgroupFilter, riskFilter]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSubgroupFilter('all');
    setRiskFilter('all');
    onClearStatusFilter();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por empresa ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {allStatuses.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subgroupFilter} onValueChange={setSubgroupFilter}>
            <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Subgrupo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos subgrupos</SelectItem>
              {subgroups.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Grau de Risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os graus</SelectItem>
              {riskGrades.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || statusFilter !== 'all' || subgroupFilter !== 'all' || riskFilter !== 'all') && (
            <Button variant="ghost" size="icon" onClick={clearFilters}><X className="h-4 w-4" /></Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{filteredClients.length} clientes encontrados</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Subgrupo</TableHead>
                <TableHead className="text-center">GR</TableHead>
                <TableHead className="text-center">Vidas</TableHead>
                <TableHead className="text-center">Contrato</TableHead>
                <TableHead className="text-center">Assinado</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-center">Tabela</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewClient(c.id)}>
                  <TableCell className="font-medium max-w-[200px] truncate">{c.company_name}</TableCell>
                  <TableCell className="text-xs">{c.cnpj || '—'}</TableCell>
                  <TableCell className="text-xs">{c.subgroup}</TableCell>
                  <TableCell className="text-center text-xs">{c.risk_grade}</TableCell>
                  <TableCell className="text-center">{c.active_lives}</TableCell>
                  <TableCell className="text-center">{c.has_contract ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : '—'}</TableCell>
                  <TableCell className="text-center">{c.contract_signed ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : '—'}</TableCell>
                  <TableCell className="text-xs">{c.contract_end_date || '—'}</TableCell>
                  <TableCell className="text-center">{c.pricing_table_attached ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : '—'}</TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[c.status_geral]} text-xs whitespace-nowrap`}>
                      {statusLabels[c.status_geral]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); onViewClient(c.id); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
