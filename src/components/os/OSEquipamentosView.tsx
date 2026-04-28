import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Search, History, CalendarIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { cn } from '@/lib/utils';
import { useOSEquipamentos } from '@/hooks/useOSEquipamentos';
import { OSEquipamento, OSEquipamentoHistorico, getCalibracaoStatus, calibracaoStatusColors } from '@/types/osVisitas';
import { OrdemServico } from '@/types/os';

interface OSEquipamentosViewProps {
  ordens: OrdemServico[]; // mantido para assinatura compatível
  canEdit: boolean;
}

const emptyForm = {
  nome: '',
  tipo: '',
  fabricante: '',
  certificado: '',
  data_ultima_calibracao: null as Date | null,
  observacoes: '',
  ativo: true,
  is_locacao: false,
  locacao_fornecedor: '',
  locacao_cnpj: '',
  locacao_nf_numero: '',
  locacao_nf_data: null as Date | null,
  locacao_custo: '',
};

export function OSEquipamentosView({ canEdit }: OSEquipamentosViewProps) {
  const { equipamentos, isLoading, addEquipamento, updateEquipamento, deleteEquipamento, getHistorico } = useOSEquipamentos();
  const [search, setSearch] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<OSEquipamento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<OSEquipamento | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState<OSEquipamento | null>(null);
  const [historicoData, setHistoricoData] = useState<OSEquipamentoHistorico[]>([]);

  const filtered = useMemo(() => equipamentos.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.nome.toLowerCase().includes(s) ||
      (e.tipo || '').toLowerCase().includes(s) ||
      (e.fabricante || '').toLowerCase().includes(s)
    );
  }), [equipamentos, search]);

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
      fabricante: eq.fabricante || '',
      certificado: eq.certificado || '',
      data_ultima_calibracao: eq.data_ultima_calibracao ? new Date(eq.data_ultima_calibracao + 'T00:00:00') : null,
      observacoes: eq.observacoes || '',
      ativo: eq.ativo,
      is_locacao: eq.is_locacao || false,
      locacao_fornecedor: eq.locacao_fornecedor || '',
      locacao_cnpj: eq.locacao_cnpj || '',
      locacao_nf_numero: eq.locacao_nf_numero || '',
      locacao_nf_data: eq.locacao_nf_data ? new Date(eq.locacao_nf_data + 'T00:00:00') : null,
      locacao_custo: eq.locacao_custo != null ? String(eq.locacao_custo) : '',
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    if (form.is_locacao && !form.locacao_fornecedor.trim()) {
      return;
    }
    const payload = {
      nome: form.nome,
      tipo: form.tipo || null,
      fabricante: form.fabricante || null,
      certificado: form.certificado || null,
      data_ultima_calibracao: form.data_ultima_calibracao ? format(form.data_ultima_calibracao, 'yyyy-MM-dd') : null,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
      is_locacao: form.is_locacao,
      locacao_fornecedor: form.is_locacao ? (form.locacao_fornecedor || null) : null,
      locacao_cnpj: form.is_locacao ? (form.locacao_cnpj || null) : null,
      locacao_nf_numero: form.is_locacao ? (form.locacao_nf_numero || null) : null,
      locacao_nf_data: form.is_locacao && form.locacao_nf_data ? format(form.locacao_nf_data, 'yyyy-MM-dd') : null,
      locacao_custo: form.is_locacao && form.locacao_custo ? parseFloat(form.locacao_custo) : null,
    };
    const ok = editing
      ? await updateEquipamento(editing.id, payload)
      : await addEquipamento(payload);
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
          <h2 className="text-xl font-semibold">Equipamentos de Medição</h2>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie os equipamentos utilizados nas visitas técnicas.</p>
        </div>
        {canEdit && <Button onClick={handleNew}><Plus className="mr-2 h-4 w-4" /> Novo Equipamento</Button>}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, tipo ou fabricante" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Última Calibração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(eq => {
                    const cal = getCalibracaoStatus(eq.data_ultima_calibracao);
                    return (
                      <TableRow key={eq.id}>
                        <TableCell className="font-medium">{eq.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{eq.tipo || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{eq.fabricante || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {eq.data_ultima_calibracao
                            ? format(new Date(eq.data_ultima_calibracao + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell><Badge className={calibracaoStatusColors[cal.status]}>{cal.label}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={eq.ativo ? 'default' : 'secondary'}>{eq.ativo ? 'Sim' : 'Não'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openHistorico(eq)}><History className="h-4 w-4" /></Button>
                            {canEdit && <Button variant="ghost" size="icon" onClick={() => handleEdit(eq)}><Pencil className="h-4 w-4" /></Button>}
                            {canEdit && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(eq)}><Trash2 className="h-4 w-4" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Dosímetro de Ruído" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Input value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} placeholder="Ex: Medidor de Ruído" />
            </div>
            <div className="space-y-1">
              <Label>Fabricante</Label>
              <Input value={form.fabricante} onChange={e => setForm({ ...form, fabricante: e.target.value })} placeholder="Ex: 3M, Instrutherm" />
            </div>
            <div className="space-y-1">
              <Label>Data da Última Calibração</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !form.data_ultima_calibracao && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.data_ultima_calibracao
                      ? format(form.data_ultima_calibracao, 'dd/MM/yyyy', { locale: ptBR })
                      : 'Selecione uma data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.data_ultima_calibracao || undefined}
                    onSelect={(d) => setForm({ ...form, data_ultima_calibracao: d || null })}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Equipamento ativo</Label>
                <p className="text-xs text-muted-foreground">Disponível para agendamento</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nome.trim()}>
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
