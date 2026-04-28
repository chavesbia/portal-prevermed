import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, Package, Check, ChevronsUpDown, Boxes } from 'lucide-react';
import {
  useCommercialServices,
  usePackageComponents,
  useAllPackageComponents,
  normalizeCategory,
  type CommercialService,
} from '@/hooks/useCommercialServices';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { cn } from '@/lib/utils';

const MODULE_ROUTE = '/carteira-comercial';

export default function ServicesConfigTab() {
  const { services, isLoading, createService, updateService, deleteService } = useCommercialServices();
  const { hasPermission } = useModulePermissions();
  const canEdit = hasPermission(MODULE_ROUTE, 'edit');
  const canDelete = hasPermission(MODULE_ROUTE, 'delete');
  const { all: allComponentLinks } = useAllPackageComponents();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialService | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    is_active: true,
    is_package: false,
  });
  const [packageComponentIds, setPackageComponentIds] = useState<string[]>([]);

  // Lista única de categorias existentes (UPPERCASE)
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      const c = normalizeCategory(s.category);
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [services]);

  // Mapa: package_id -> qtd componentes (para badge na lista)
  const componentsCountByPackage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const link of allComponentLinks) {
      map[link.package_id] = (map[link.package_id] || 0) + 1;
    }
    return map;
  }, [allComponentLinks]);

  const { components: editingComponents, setComponents: saveComponents } = usePackageComponents(
    editing?.is_package ? editing.id : undefined,
  );

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', code: '', category: '', description: '', is_active: true, is_package: false });
    setPackageComponentIds([]);
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
      is_package: s.is_package,
    });
    // será populado pelo useEffect abaixo via editingComponents
    setPackageComponentIds([]);
    setOpen(true);
  };

  // Sincroniza ids dos componentes ao abrir edição
  useMemo(() => {
    if (editing?.is_package) {
      setPackageComponentIds(editingComponents.map(c => c.component_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingComponents, editing?.id]);

  const submit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim().toUpperCase(),
      code: form.code.trim() || null,
      category: normalizeCategory(form.category),
      description: form.description.trim() || null,
      is_active: form.is_active,
      is_package: form.is_package,
    };
    let savedId: string | undefined;
    if (editing) {
      const updated = await updateService.mutateAsync({ id: editing.id, ...payload });
      savedId = updated?.id || editing.id;
    } else {
      const created = await createService.mutateAsync(payload);
      savedId = created?.id;
    }
    // Persistir componentes do pacote
    if (savedId && payload.is_package) {
      // Use o saver associado ao id atualmente em edição apenas se for o mesmo;
      // como o hook é vinculado a editing?.id, refazemos com o id certo.
      // Para simplicidade, salvamos diretamente:
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase
        .from('commercial_service_components')
        .delete()
        .eq('package_id', savedId);
      if (packageComponentIds.length > 0) {
        await supabase
          .from('commercial_service_components')
          .insert(packageComponentIds.map(cid => ({ package_id: savedId!, component_id: cid })) as any);
      }
    }
    setOpen(false);
  };

  const grouped: Record<string, CommercialService[]> = {};
  for (const s of services) {
    const cat = s.category || 'OUTROS';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  const componentCandidates = services.filter(
    s => s.is_active && !s.is_package && (!editing || s.id !== editing.id),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Catálogo de Serviços</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre serviços avulsos (ex: PCMSO, PGR) ou <strong>pacotes modulares</strong> (ex: PACOTE SST) que agrupam vários serviços.
            </p>
          </div>
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Novo Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: PCMSO ou PACOTE SST"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Categoria</Label>
                      <CategoryCombobox
                        value={form.category}
                        onChange={v => setForm({ ...form, category: v })}
                        options={existingCategories}
                      />
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
                  <div className="flex items-center justify-between gap-4 p-3 rounded-md border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <div>
                        <Label className="text-sm">É um pacote modular</Label>
                        <p className="text-xs text-muted-foreground">
                          Pacotes agrupam outros serviços (ex: PACOTE SST = PCMSO + PGR + DRPS).
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={form.is_package}
                      onCheckedChange={v => setForm({ ...form, is_package: v })}
                    />
                  </div>

                  {form.is_package && (
                    <div className="space-y-2 p-3 rounded-md border border-primary/30 bg-primary/5">
                      <Label className="flex items-center gap-1.5">
                        <Boxes className="h-4 w-4" />
                        Componentes padrão do pacote
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Selecione os serviços que normalmente compõem este pacote. Ao vincular o pacote a um cliente,
                        você poderá habilitar/desabilitar cada item de acordo com a necessidade.
                      </p>
                      <ScrollArea className="h-52 border rounded-md bg-background">
                        <div className="p-2 space-y-1">
                          {componentCandidates.length === 0 && (
                            <p className="text-xs text-muted-foreground p-2">
                              Cadastre primeiro os serviços avulsos que compõem o pacote.
                            </p>
                          )}
                          {componentCandidates.map(s => (
                            <label
                              key={s.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={packageComponentIds.includes(s.id)}
                                onCheckedChange={() => {
                                  setPackageComponentIds(prev =>
                                    prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id],
                                  );
                                }}
                              />
                              <span className="flex-1">{s.name}</span>
                              {s.category && (
                                <span className="text-[10px] text-muted-foreground uppercase">{s.category}</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground">
                        {packageComponentIds.length} componente(s) selecionado(s).
                      </p>
                    </div>
                  )}

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
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          {s.is_package && <Package className="h-4 w-4 text-primary flex-shrink-0" />}
                          <span className="text-sm font-medium truncate">{s.name}</span>
                          {s.is_package && (
                            <Badge variant="secondary" className="text-[10px]">
                              Pacote · {componentsCountByPackage[s.id] || 0} item(ns)
                            </Badge>
                          )}
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
                                      Esta ação removerá o serviço, seus vínculos com clientes
                                      {s.is_package ? ' e a composição do pacote.' : '.'}
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

/** Combobox de categoria: lista existentes + permite criar nova (normalizada UPPERCASE). */
function CategoryCombobox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const normalized = normalizeCategory(search) || '';
  const exactMatch = options.some(o => o === normalized);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          {value || 'Selecionar categoria...'}
          <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar ou digitar nova..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {normalized ? (
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                  onClick={() => {
                    onChange(normalized);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  + Criar categoria <strong>{normalized}</strong>
                </button>
              ) : (
                <span className="text-xs text-muted-foreground p-2">Digite para buscar.</span>
              )}
            </CommandEmpty>
            <CommandGroup heading="Categorias existentes">
              {options.map(opt => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn('h-4 w-4 mr-2', value === opt ? 'opacity-100' : 'opacity-0')}
                  />
                  {opt}
                </CommandItem>
              ))}
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Limpar categoria
                </CommandItem>
              )}
              {normalized && !exactMatch && (
                <CommandItem
                  value={`__new__${normalized}`}
                  onSelect={() => {
                    onChange(normalized);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  + Criar <strong className="ml-1">{normalized}</strong>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
