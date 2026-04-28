import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useCommercialServices, type CommercialService } from '@/hooks/useCommercialServices';
import { useModulePermissions } from '@/hooks/useModulePermissions';

const MODULE_ROUTE = '/carteira-comercial';

export default function ServicesConfigTab() {
  const { services, isLoading, createService, updateService, deleteService } = useCommercialServices();
  const { hasPermission } = useModulePermissions();
  const canEdit = hasPermission(MODULE_ROUTE, 'edit');
  const canDelete = hasPermission(MODULE_ROUTE, 'delete');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialService | null>(null);
  const [form, setForm] = useState({ name: '', code: '', category: '', description: '', is_active: true });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', code: '', category: '', description: '', is_active: true });
    setOpen(true);
  };

  const openEdit = (s: CommercialService) => {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code || '',
      category: s.category || '',
      description: s.description || '',
      is_active: s.is_active,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
    };
    if (editing) await updateService.mutateAsync({ id: editing.id, ...payload });
    else await createService.mutateAsync(payload);
    setOpen(false);
  };

  const grouped: Record<string, CommercialService[]> = {};
  for (const s of services) {
    const cat = s.category || 'Outros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Catálogo de Serviços</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre os serviços que poderão ser vinculados como TAGs aos contratos dos clientes.
            </p>
          </div>
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Novo Serviço
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Categoria</Label>
                      <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: Saúde Ocupacional" />
                    </div>
                    <div>
                      <Label>Código</Label>
                      <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Opcional" />
                    </div>
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                    <Label>Ativo</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={submit} disabled={createService.isPending || updateService.isPending}>
                    {(createService.isPending || updateService.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum serviço cadastrado.</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{cat}</h4>
                  <div className="space-y-1.5">
                    {items.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-md border hover:bg-accent/40">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{s.name}</span>
                          {!s.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                          {s.code && <span className="text-xs text-muted-foreground">[{s.code}]</span>}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {canDelete && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover serviço?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação removerá o serviço e seus vínculos com clientes.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteService.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
