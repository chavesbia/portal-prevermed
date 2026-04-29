import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AREA_LABELS,
  CatalogArea,
  CatalogService,
  CatalogServiceType,
  TYPE_LABELS,
  useCatalogServices,
} from "@/hooks/useCatalogServices";
import {
  BookOpen,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PackageComposerDialog } from "@/components/admin/PackageComposerDialog";

const fmt = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

interface DraftService {
  id?: string;
  name: string;
  category: string;
  area: CatalogArea;
  service_type: CatalogServiceType;
  package_eligible: boolean;
  description: string;
  validity_months: string;
  delivery_days: string;
  reference_value: string;
  is_active: boolean;
}

const emptyDraft = (): DraftService => ({
  name: "",
  category: "Laudo",
  area: "SAUDE",
  service_type: "AVULSO",
  package_eligible: true,
  description: "",
  validity_months: "",
  delivery_days: "",
  reference_value: "",
  is_active: true,
});

export function LaudosServicosManager() {
  const { isAdmMaster } = useAuth();
  const { services, categories, isLoading, upsert, remove, restore } =
    useCatalogServices();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftService>(emptyDraft());
  const [newCategory, setNewCategory] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerService, setComposerService] = useState<CatalogService | null>(null);

  const openComposer = (svc: CatalogService) => {
    setComposerService(svc);
    setComposerOpen(true);
  };

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (!showInactive && !s.is_active) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (areaFilter !== "all" && s.area !== areaFilter) return false;
      if (
        search &&
        !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !(s.description || "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [services, search, categoryFilter, areaFilter, showInactive]);

  const startCreate = () => {
    setDraft(emptyDraft());
    setNewCategory("");
    setOpen(true);
  };

  const startEdit = (svc: CatalogService) => {
    setDraft({
      id: svc.id,
      name: svc.name,
      category: svc.category,
      area: svc.area,
      service_type: svc.service_type,
      package_eligible: svc.package_eligible,
      description: svc.description || "",
      validity_months: svc.validity_months?.toString() || "",
      delivery_days: svc.delivery_days?.toString() || "",
      reference_value: svc.reference_value?.toString() || "",
      is_active: svc.is_active,
    });
    setNewCategory("");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    const finalCategory = newCategory.trim() || draft.category;
    await upsert.mutateAsync({
      id: draft.id,
      name: draft.name,
      category: finalCategory,
      area: draft.area,
      service_type: draft.service_type,
      package_eligible: draft.package_eligible,
      description: draft.description || null,
      validity_months: draft.validity_months ? Number(draft.validity_months) : null,
      delivery_days: draft.delivery_days ? Number(draft.delivery_days) : null,
      reference_value: draft.reference_value ? Number(draft.reference_value) : null,
      is_active: draft.is_active,
    });
    setOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Laudos e Serviços
            </CardTitle>
            <CardDescription>
              Catálogo central de laudos, treinamentos, palestras, perícias e demais
              serviços. Reutilizado em Renovação, Proposta, Contrato, OS e Faturamento.
            </CardDescription>
          </div>
          {isAdmMaster && (
            <Button onClick={startCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou descrição..."
              className="pl-9 pr-9"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas áreas</SelectItem>
              <SelectItem value="SAUDE">Saúde</SelectItem>
              <SelectItem value="SEGURANCA">Segurança</SelectItem>
              <SelectItem value="AMBOS">Ambos</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showInactive}
              onCheckedChange={(v) => setShowInactive(v === true)}
            />
            Mostrar inativos
          </label>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Pacote?</TableHead>
                <TableHead className="text-right">Validade</TableHead>
                <TableHead className="text-right">Prazo</TableHead>
                <TableHead className="text-right">Valor Ref.</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    Nenhum serviço cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="font-medium">{titleCase(s.name)}</div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {s.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {s.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {AREA_LABELS[s.area]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={s.service_type === "RECORRENTE" ? "default" : "outline"}
                        className="text-xs"
                      >
                        {TYPE_LABELS[s.service_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {s.package_eligible ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {s.validity_months ? `${s.validity_months} m` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {s.delivery_days ? `${s.delivery_days} d` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {s.reference_value != null ? fmt(s.reference_value) : "—"}
                    </TableCell>
                    <TableCell>
                      {isAdmMaster && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {s.is_active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => remove.mutate(s.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => restore.mutate(s.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            <DialogDescription>
              Os nomes são armazenados em MAIÚSCULAS para evitar duplicidade.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex.: LAUDO LTCAT"
                style={{ textTransform: "uppercase" }}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={draft.category}
                onValueChange={(v) => setDraft({ ...draft, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Ou digite uma nova categoria"
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Select
                value={draft.area}
                onValueChange={(v) => setDraft({ ...draft, area: v as CatalogArea })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAUDE">Saúde</SelectItem>
                  <SelectItem value="SEGURANCA">Segurança</SelectItem>
                  <SelectItem value="AMBOS">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={draft.service_type}
                onValueChange={(v) =>
                  setDraft({ ...draft, service_type: v as CatalogServiceType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVULSO">Avulso</SelectItem>
                  <SelectItem value="RECORRENTE">Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor de Referência (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={draft.reference_value}
                onChange={(e) =>
                  setDraft({ ...draft, reference_value: e.target.value })
                }
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Validade (meses)</Label>
              <Input
                type="number"
                value={draft.validity_months}
                onChange={(e) =>
                  setDraft({ ...draft, validity_months: e.target.value })
                }
                placeholder="Ex.: 12"
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo de entrega (dias)</Label>
              <Input
                type="number"
                value={draft.delivery_days}
                onChange={(e) => setDraft({ ...draft, delivery_days: e.target.value })}
                placeholder="Ex.: 30"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.package_eligible}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, package_eligible: v === true })
                  }
                />
                Elegível para compor pacote
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.is_active}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, is_active: v === true })
                  }
                />
                Ativo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !draft.name.trim()}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
