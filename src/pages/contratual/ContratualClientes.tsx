import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getContractStatusDisplay } from '@/lib/contractual/statusLabels';
import { formatBRL, formatDateBR } from '@/lib/contractual/format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCNPJ } from '@/lib/contractual/format';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ContratualClienteDialog } from './ContratualClienteDialog';

interface Props { canEdit: boolean }

export default function ContratualClientes({ canEdit }: Props) {
  const qc = useQueryClient();
  const { isAdmMaster } = useAuth();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['contract-clientes-contatos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_clientes')
        .select('*, company:companies(id, razao_social, cnpj, cidade, estado, is_active)');
      if (error) throw error;

      const { data: contratos, error: cErr } = await supabase
        .from('contract_contratos')
        .select('id, cliente_id, numero_contrato, status, data_inicio, data_fim, valor_mensal, tem_html_final');
      if (cErr) throw cErr;

      const counts = new Map<string, number>();
      const porCliente = new Map<string, any[]>();
      (contratos || []).forEach((c: any) => {
        if (!c.cliente_id) return;
        counts.set(c.cliente_id, (counts.get(c.cliente_id) || 0) + 1);
        porCliente.set(c.cliente_id, [...(porCliente.get(c.cliente_id) || []), { ...c, html_final: c.tem_html_final ? '1' : null }]);
      });

      return (data || [])
        .map((c: any) => ({
          ...c,
          // Razão social e CNPJ sempre a partir da base mestre (companies), quando vinculada
          display_razao: c.company?.razao_social || c.razao_social,
          display_cnpj: c.company?.cnpj || c.cnpj,
          display_local: [c.company?.cidade ?? c.cidade, c.company?.estado ?? c.estado].filter(Boolean).join(' / '),
          from_master: !!c.company,
          contratos_count: counts.get(c.id) || 0,
          contratos: (porCliente.get(c.id) || []).sort((a: any, b: any) => (b.data_inicio || '').localeCompare(a.data_inicio || '')),
        }))
        .sort((a: any, b: any) => (a.display_razao || '').localeCompare(b.display_razao || ''));
    },
  });

  const [sp, setSp] = useSearchParams();
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<any>(null);
  const PAGE = 25;
  const norm = (x: string) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = useMemo(() => {
    const termos = norm(search).split(/\s+/).filter(Boolean);
    const digits = search.replace(/\D/g, '');
    if (!termos.length) return clientes;
    return clientes.filter((c: any) =>
      termos.every(t => norm(`${c.display_razao} ${c.representante_legal || ''} ${c.email || ''}`).includes(t)) ||
      (digits.length >= 3 && (c.display_cnpj || '').replace(/\D/g, '').includes(digits)));
  }, [clientes, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pg = Math.min(page, totalPages);
  const paginaClientes = filtered.slice((pg - 1) * PAGE, pg * PAGE);
  const abrirContrato = (id: string) => setSp(new URLSearchParams({ tab: 'contratos', contrato: id }), { replace: true });

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('contract_clientes').delete().eq('id', toDelete.id);
      if (error) {
        if (error.code === '23503' || /foreign key|violates/i.test(error.message)) {
          throw new Error(`Não é possível excluir — este cliente tem ${toDelete.contratos_count || 'alguns'} contrato(s) vinculado(s).`);
        }
        throw error;
      }
      toast.success('Cliente excluído');
      qc.invalidateQueries({ queryKey: ['contract-clientes-contatos'] });
      setToDelete(null);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

  const tryDelete = (c: any) => {
    if (c.contratos_count > 0) {
      toast.error(`Não é possível excluir — este cliente tem ${c.contratos_count} contrato(s) vinculado(s).`);
      return;
    }
    setToDelete(c);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por CNPJ ou razão social…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">{filtered.length} cliente(s) · clique para ver os contratos</span>
        {/* Novos clientes contratuais são criados automaticamente ao selecionar uma
            empresa da base mestre do SOC no assistente de Novo Contrato. */}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Representante Legal</TableHead>
                  <TableHead className="text-center">Contratos</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nenhum cliente cadastrado.</TableCell></TableRow>
                )}
                {paginaClientes.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setViewing(c)}>
                    <TableCell>
                      <div className="font-medium">{c.display_razao}</div>
                      {!c.from_master && (
                        <div className="text-[11px] text-muted-foreground">Sem vínculo com a base mestre</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatCNPJ(c.display_cnpj)}</TableCell>
                    <TableCell>{c.display_local || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {c.telefone || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate" title={c.email || ''}>
                      {c.email || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={c.representante_legal || ''}>
                      {c.representante_legal || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.contratos_count > 0 ? 'secondary' : 'outline'}>{c.contratos_count}</Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar contato e representante"
                            onClick={() => { setEditing(c); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmMaster && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Excluir cliente" onClick={() => tryDelete(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > PAGE && (
            <div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-sm">
              <span className="text-muted-foreground">Página {pg} de {totalPages}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={pg <= 1} onClick={() => setPage(pg - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={pg >= totalPages} onClick={() => setPage(pg + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{viewing?.display_razao}</SheetTitle>
          </SheetHeader>
          {viewing && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><div className="text-xs text-muted-foreground">CNPJ</div><div className="font-mono">{formatCNPJ(viewing.display_cnpj)}</div></div>
                <div><div className="text-xs text-muted-foreground">Cidade/UF</div><div>{viewing.display_local || '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">Telefone</div><div>{viewing.telefone || '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">E-mail</div><div className="break-all">{viewing.email || '—'}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Representante legal</div><div>{viewing.representante_legal || '—'}</div></div>
              </div>
              <div>
                <div className="font-semibold mb-2 flex items-center gap-1.5"><FileText className="h-4 w-4" /> Contratos ({viewing.contratos.length})</div>
                {viewing.contratos.length === 0 && <div className="text-muted-foreground">Nenhum contrato para este cliente.</div>}
                <div className="space-y-2">
                  {viewing.contratos.map((ct: any) => {
                    const stD = getContractStatusDisplay(ct);
                    return (
                      <button key={ct.id} onClick={() => abrirContrato(ct.id)}
                        className="w-full text-left rounded-md border p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs">{ct.numero_contrato}</span>
                          <Badge variant="secondary" className={`${stD.tone} whitespace-nowrap`}>{stD.label}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                          <span>{formatDateBR(ct.data_inicio)} → {formatDateBR(ct.data_fim)}</span>
                          <span>{formatBRL(ct.valor_mensal)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => { setEditing(viewing); setOpen(true); }} className="gap-1.5">
                  <Pencil className="h-4 w-4" /> Editar contato e representante
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ContratualClienteDialog
        open={open}
        onOpenChange={setOpen}
        cliente={editing}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['contract-clientes-contatos'] }); setOpen(false); }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro de contato/representante de <strong>{toDelete?.display_razao}</strong> será removido
              permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={deleting}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
