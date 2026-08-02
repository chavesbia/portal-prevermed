import { useState } from 'react';
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
        .select('cliente_id');
      if (cErr) throw cErr;

      const counts = new Map<string, number>();
      (contratos || []).forEach((c: any) => {
        if (c.cliente_id) counts.set(c.cliente_id, (counts.get(c.cliente_id) || 0) + 1);
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
        }))
        .sort((a: any, b: any) => (a.display_razao || '').localeCompare(b.display_razao || ''));
    },
  });

  const term = search.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const filtered = !term ? clientes : clientes.filter((c: any) =>
    (c.display_razao || '').toLowerCase().includes(term) ||
    (digits && (c.display_cnpj || '').replace(/\D/g, '').includes(digits))
  );

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
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
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
                {filtered.map((c: any) => (
                  <TableRow key={c.id}>
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
                    <TableCell>
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
        </CardContent>
      </Card>

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
