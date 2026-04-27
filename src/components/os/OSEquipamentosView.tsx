import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Search, History } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useOSEquipamentos } from '@/hooks/useOSEquipamentos';
import { OSEquipamento, OSEquipamentoHistorico, EQUIPAMENTO_STATUS_OPTIONS, EquipamentoStatus, equipamentoStatusColors, equipamentoStatusLabel } from '@/types/osVisitas';
import { OrdemServico } from '@/types/os';

interface OSEquipamentosViewProps {
  ordens: OrdemServico[];
  canEdit: boolean;
}

const emptyForm = {
  nome: '',
  tipo: '',
  empresa_cliente: '',
  localizacao: '',
  status: 'ativo' as EquipamentoStatus,
  observacoes: '',
};

export function OSEquipamentosView({ ordens, canEdit }: OSEquipamentosViewProps) {
  const { equipamentos, isLoading, addEquipamento, updateEquipamento, deleteEquipamento, getHistorico } = useOSEquipamentos();
  const [search, setSearch] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<OSEquipamento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<OSEquipamento | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState<OSEquipamento | null>(null);
  const [historicoData, setHistoricoData] = useState<OSEquipamentoHistorico[]>([]);

  const empresas = useMemo(() => {
    const set = new Set<string>([...equipamentos.map(e => e.empresa_cliente), ...ordens.map(o => o.empresa_cliente)]);
    return Array.from(set).sort();
  }, [equipamentos, ordens]);

  const filtered = equipamentos.filter(e => {
    if (search) {
      const s = search.toLowerCase();
      if (!e.nome.toLowerCase().includes(s) && !e.empresa_cliente.toLowerCase().includes(s) && !(e.tipo || '').toLowerCase().includes(s)) return false;
    }
    if (empresaFilter !== 'all' && e.empresa_cliente !== empresaFilter) return false;
    return true;
  });

  const handleNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpenDialog(true);
  };

  const handleEdit = (eq: OSEquipamento) => {
    setEditing(eq);
    setForm({
      nome: eq.nome,
      tipo: eq.tipo || '',
      empresa_cliente: eq.empresa_cliente,
      localizacao: eq.localizacao || '',
      status: eq.status,
      observacoes: eq.observacoes || '',
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.empresa_cliente.trim()) return;
    const ok = editing
      ? await updateEquipamento(editing.id, form)
      : await addEquipamento(form);
    if (ok) setOpenDialog(false);
  };

  const openHistorico = async (eq: OSEquipamento) => {
    setHistoricoOpen(eq);
    const data = await getHistorico(eq.id);
    setHistoricoData(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Equipamentos</h2>
          <p className="text-sm text-muted-foreground">Cadastro de equipamentos por cliente.</p>
        </div>
        {canEdit && <Button onClick={handleNew}><Plus className="mr-2 h-4 w-4" /> Novo Equipamento</Button>}
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, tipo ou cliente" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {empresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Equipamentos ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum equipamento cadastrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(eq => (
                    <TableRow key={eq.id}>
                      <TableCell className="font-medium">{eq.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{eq.tipo || '-'}</TableCell>
                      <TableCell>{eq.empresa_cliente}</TableCell>
                      <TableCell className="text-muted-foreground">{eq.localizacao || '-'}</TableCell>
                      <TableCell><Badge className={equipamentoStatusColors[eq.status]}>{equipamentoStatusLabel[eq.status]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openHistorico(eq)}><History className="h-4 w-4" /></Button>
                          {canEdit && <Button variant="ghost" size="icon" onClick={() => handleEdit(eq)}><Pencil className="h-4 w-4" /></Button>}
                          {canEdit && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(eq)}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog formulário */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Input value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} placeholder="Ex: Dosímetro, Bomba" />
            </div>
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Input list="empresa-eq-list" value={form.empresa_cliente} onChange={e => setForm({ ...form, empresa_cliente: e.target.value })} />
              <datalist id="empresa-eq-list">{empresas.map(e => <option key={e} value={e} />)}</datalist>
            </div>
            <div className="space-y-1">
              <Label>Localização</Label>
              <Input value={form.localizacao} onChange={e => setForm({ ...form, localizacao: e.target.value })} placeholder="Setor / sala / unidade" />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as EquipamentoStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EQUIPAMENTO_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{equipamentoStatusLabel[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nome.trim() || !form.empresa_cliente.trim()}>
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={!!historicoOpen} onOpenChange={o => !o && setHistoricoOpen(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico — {historicoOpen?.nome}</DialogTitle></DialogHeader>
          {historicoData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem registros.</p>
          ) : (
            <div className="space-y-3">
              {historicoData.map(h => (
                <div key={h.id} className="rounded border p-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{h.user_name || 'Sistema'}</span>
                    <span>{format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                  <p className="font-medium text-sm">{h.acao}</p>
                  {h.comentario && <p className="text-sm text-muted-foreground">{h.comentario}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{toDelete?.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => {
              if (toDelete) { await deleteEquipamento(toDelete.id); setToDelete(null); }
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
