import { useMemo, useState } from "react";
import { useCommercialServices, CommercialService } from "@/hooks/useCommercialServices";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package2,
  Tag,
} from "lucide-react";
import { BackButton } from "@/components/layout/BackButton";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

interface FormState {
  id?: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  cost_value: string;
  price_standalone: string;
  price_in_plan: string;
  is_package: boolean;
  is_priceable: boolean;
  is_active: boolean;
  description: string;
  pricing_notes: string;
}

const emptyForm: FormState = {
  name: "",
  code: "",
  category: "",
  unit: "vida",
  cost_value: "",
  price_standalone: "",
  price_in_plan: "",
  is_package: false,
  is_priceable: true,
  is_active: true,
  description: "",
  pricing_notes: "",
};

export default function AdminServicosOperacionais() {
  const { services, isLoading, createService, updateService, deleteService } = useCommercialServices();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("__all__");
  const [filterType, setFilterType] = useState<string>("__all__");
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<CommercialService | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => s.category && set.add(s.category));
    return Array.from(set).sort();
  }, [services]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const txt = search.toLowerCase();
      const matchTxt =
        !txt ||
        s.name.toLowerCase().includes(txt) ||
        (s.code || "").toLowerCase().includes(txt) ||
        (s.category || "").toLowerCase().includes(txt);
      const matchCat = filterCategory === "__all__" || s.category === filterCategory;
      const matchType =
        filterType === "__all__" ||
        (filterType === "package" && s.is_package) ||
        (filterType === "service" && !s.is_package);
      return matchTxt && matchCat && matchType;
    });
  }, [services, search, filterCategory, filterType]);

  const openCreate = () => {
    setForm(emptyForm);
    setOpenDialog(true);
  };

  const openEdit = (s: CommercialService) => {
    setForm({
      id: s.id,
      name: titleCase(s.name),
      code: s.code || "",
      category: s.category ? titleCase(s.category) : "",
      unit: s.unit || "",
      cost_value: s.cost_value != null ? String(s.cost_value) : "",
      price_standalone: s.price_standalone != null ? String(s.price_standalone) : "",
      price_in_plan: s.price_in_plan != null ? String(s.price_in_plan) : "",
      is_package: s.is_package,
      is_priceable: s.is_priceable,
      is_active: s.is_active,
      description: s.description || "",
      pricing_notes: s.pricing_notes || "",
    });
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const payload: any = {
      // armazenar em UPPERCASE conforme padrão do projeto
      name: form.name.trim().toUpperCase(),
      code: form.code.trim() || null,
      category: form.category.trim() ? form.category.trim().toUpperCase() : null,
      unit: form.unit.trim() || null,
      cost_value: form.cost_value === "" ? null : Number(form.cost_value),
      price_standalone: form.price_standalone === "" ? null : Number(form.price_standalone),
      price_in_plan: form.price_in_plan === "" ? null : Number(form.price_in_plan),
      is_package: form.is_package,
      is_priceable: form.is_priceable,
      is_active: form.is_active,
      description: form.description.trim() || null,
      pricing_notes: form.pricing_notes.trim() || null,
    };

    if (form.id) {
      await updateService.mutateAsync({ id: form.id, ...payload });
    } else {
      await createService.mutateAsync(payload);
    }
    setOpenDialog(false);
  };

  return (
    <div className="space-y-6">
      <BackButton />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package2 className="h-6 w-6 text-primary" />
            Catálogo de Serviços Operacionais
          </h1>
          <p className="text-muted-foreground">
            Cadastro central de serviços, pacotes e preços usados pela Carteira Comercial,
            Precificação e demais módulos.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo serviço
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Nome, código ou categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-48">
              <Label className="text-xs">Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {titleCase(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Label className="text-xs">Tipo</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="service">Serviço avulso</SelectItem>
                  <SelectItem value="package">Pacote</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Serviço</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Preço avulso</TableHead>
                  <TableHead className="text-right">Preço no plano</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum serviço encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{titleCase(s.name)}</div>
                        {s.code && (
                          <div className="text-xs text-muted-foreground">{s.code}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.category ? (
                          <Badge variant="outline" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {titleCase(s.category)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{s.unit || "—"}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.cost_value)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.price_standalone)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.price_in_plan)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col gap-1 items-center">
                          {s.is_package && (
                            <Badge variant="secondary" className="text-xs">Pacote</Badge>
                          )}
                          {!s.is_active && (
                            <Badge variant="destructive" className="text-xs">Inativo</Badge>
                          )}
                          {s.is_active && !s.is_package && (
                            <Badge variant="default" className="text-xs">Ativo</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setConfirmDelete(s)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar serviço" : "Novo serviço"}
            </DialogTitle>
            <DialogDescription>
              Cadastre/edite serviços do catálogo central. Nomes e categorias serão
              normalizados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Consulta Clínica Ocupacional"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex.: CCO-01"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Ex.: Exames, Laudos, Consultas"
                  list="categories-list"
                />
                <datalist id="categories-list">
                  {categories.map((c) => (
                    <option key={c} value={titleCase(c)} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="vida / mês / unidade / hora"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost_value}
                  onChange={(e) => setForm({ ...form, cost_value: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço avulso (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price_standalone}
                  onChange={(e) => setForm({ ...form, price_standalone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço no plano (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price_in_plan}
                  onChange={(e) => setForm({ ...form, price_in_plan: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3 border-t pt-3">
              <label className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span className="text-sm">É pacote?</span>
                <Switch
                  checked={form.is_package}
                  onCheckedChange={(v) => setForm({ ...form, is_package: v })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span className="text-sm">Precificável</span>
                <Switch
                  checked={form.is_priceable}
                  onCheckedChange={(v) => setForm({ ...form, is_priceable: v })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span className="text-sm">Ativo</span>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="O que está incluído neste serviço..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas de precificação</Label>
              <Textarea
                rows={2}
                value={form.pricing_notes}
                onChange={(e) => setForm({ ...form, pricing_notes: e.target.value })}
                placeholder="Regras especiais, limites, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name.trim() || createService.isPending || updateService.isPending}
            >
              {form.id ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmDelete && titleCase(confirmDelete.name)}</strong> será removido
              do catálogo. Vínculos com clientes não serão afetados, mas o serviço deixará de
              aparecer em novas seleções. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDelete) {
                  await deleteService.mutateAsync(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
