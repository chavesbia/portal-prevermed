import { useState, useMemo } from "react";
import { Settings, Percent, Plus, Pencil, Trash2, Save, Search, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ServiceItem } from "@/types/pricing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useServices } from "@/hooks/useServices";
import { LaudosServicosManager } from "@/components/admin/LaudosServicosManager";

interface EditingServiceWithMargin extends ServiceItem {
  marginPercent?: number;
  infoText?: string;
}

export function AdminTab() {
  const { 
    services, 
    isLoading, 
    saveService, 
    deleteService, 
    updateManyServices 
  } = useServices();

  const [editingService, setEditingService] = useState<EditingServiceWithMargin | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [globalMargin, setGlobalMargin] = useState(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filtrar serviços com base na busca e categoria
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        searchTerm === "" ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" || service.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [services, searchTerm, categoryFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateMargin = (costValue: number, unitValue: number) => {
    if (unitValue <= 0) return 0;
    return ((unitValue - costValue) / unitValue) * 100;
  };

  const calculateUnitValueFromMargin = (costValue: number, marginPercent: number) => {
    if (marginPercent >= 100) return costValue * 10;
    return costValue / (1 - marginPercent / 100);
  };

  const handleSaveService = async () => {
    if (!editingService) return;

    if (!editingService.code.trim()) {
      toast.error("Código é obrigatório");
      return;
    }
    if (!editingService.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    setIsSaving(true);

    // Remover marginPercent antes de salvar
    const { marginPercent, ...serviceToSave } = editingService;
    
    // Verificar se é novo (NÃO gerar UUID aqui - deixar para saveService)
    const isNew = serviceToSave.id.startsWith("new-");

    const success = await saveService(serviceToSave);
    
    setIsSaving(false);

    if (success) {
      setEditingService(null);
      setIsDialogOpen(false);
      toast.success(isNew ? "Serviço adicionado!" : "Serviço atualizado!");
    }
  };

  const handleDeleteService = async () => {
    if (!deleteConfirmId) return;

    setIsSaving(true);
    const success = await deleteService(deleteConfirmId);
    setIsSaving(false);
    setDeleteConfirmId(null);

    if (success) {
      toast.success("Serviço removido!");
    }
  };

  const handleApplyGlobalMargin = async () => {
    const updatedServices = services.map((s) => ({
      ...s,
      unitValue: calculateUnitValueFromMargin(s.costValue, globalMargin),
    }));

    setIsSaving(true);
    const success = await updateManyServices(updatedServices);
    setIsSaving(false);

    if (success) {
      toast.success(`Margem de ${globalMargin}% aplicada a todos os serviços!`);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      servico: "Serviço",
      deslocamento: "Custos Adicionais",
      exame_complementar: "Exame",
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      servico: "bg-primary/10 text-primary",
      deslocamento: "bg-info/10 text-info",
      exame_complementar: "bg-warning/10 text-warning",
    };
    return colors[category] || "bg-muted text-muted-foreground";
  };

  const createNewService = (): EditingServiceWithMargin => ({
    id: `new-${Date.now()}`,
    code: "",
    description: "",
    unit: "POR ATENDIMENTO",
    unitValue: 0,
    costValue: 0,
    category: "servico",
    marginPercent: 30,
  });

  const handleEditService = (service: ServiceItem) => {
    const margin = calculateMargin(service.costValue, service.unitValue);
    setEditingService({ ...service, marginPercent: margin });
    setIsDialogOpen(true);
  };

  const handleCostChange = (costValue: number) => {
    if (!editingService) return;
    const unitValue = calculateUnitValueFromMargin(costValue, editingService.marginPercent || 30);
    setEditingService({ ...editingService, costValue, unitValue });
  };

  const handleMarginChange = (marginPercent: number) => {
    if (!editingService) return;
    const unitValue = calculateUnitValueFromMargin(editingService.costValue, marginPercent);
    setEditingService({ ...editingService, marginPercent, unitValue });
  };

  const handleUnitValueChange = (unitValue: number) => {
    if (!editingService) return;
    const marginPercent = calculateMargin(editingService.costValue, unitValue);
    setEditingService({ ...editingService, unitValue, marginPercent });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configurações Globais */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Configurações de Margem
          </CardTitle>
          <CardDescription>
            Ajuste a margem global aplicada aos serviços
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Margem Padrão (%)</Label>
              <Input
                type="number"
                min={0}
                max={99}
                value={globalMargin}
                onChange={(e) => setGlobalMargin(parseInt(e.target.value) || 0)}
                className="w-32"
              />
            </div>
            <Button onClick={handleApplyGlobalMargin} variant="outline" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Aplicar a Todos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gerenciamento de Serviços */}
      <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Exames e Serviços - In Loco
              </CardTitle>
              <CardDescription>
                {filteredServices.length} de {services.length} serviços
              </CardDescription>
            </div>
            <Button onClick={() => {
              setEditingService(createNewService());
              setIsDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
          </div>
          
          {/* Busca e Filtros */}
          <div className="mt-4 flex gap-3 items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9 w-full"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] shrink-0">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="servico">Serviços</SelectItem>
                <SelectItem value="deslocamento">Custos Adicionais</SelectItem>
                <SelectItem value="exame_complementar">Exames</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchTerm || categoryFilter !== "all"
                        ? "Nenhum serviço encontrado com os filtros aplicados"
                        : "Nenhum serviço cadastrado. Clique em 'Popular Catálogo' para começar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map((service) => {
                    const margin = calculateMargin(service.costValue, service.unitValue);

                    return (
                      <TableRow key={service.id}>
                        <TableCell className="font-mono text-xs">{service.code}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={service.description}>
                          {service.description}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getCategoryColor(service.category))}>
                            {getCategoryLabel(service.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(service.costValue)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(service.unitValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-mono",
                              margin >= 30
                                ? "border-success/30 text-success"
                                : margin >= 20
                                ? "border-warning/30 text-warning"
                                : "border-destructive/30 text-destructive"
                            )}
                          >
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditService(service)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(service.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para editar/criar serviço */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setEditingService(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingService?.id.startsWith("new-")
                ? "Novo Serviço"
                : "Editar Serviço"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do serviço
            </DialogDescription>
          </DialogHeader>
          {editingService && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input
                    value={editingService.code}
                    onChange={(e) =>
                      setEditingService({ ...editingService, code: e.target.value })
                    }
                    placeholder="Ex: ASO-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={editingService.category}
                    onValueChange={(v: ServiceItem["category"]) =>
                      setEditingService({ ...editingService, category: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="deslocamento">Custos Adicionais</SelectItem>
                      <SelectItem value="exame_complementar">Exame</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input
                  value={editingService.description}
                  onChange={(e) =>
                    setEditingService({ ...editingService, description: e.target.value })
                  }
                  placeholder="Ex: Exame Admissional"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Custo (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingService.costValue || ""}
                    onChange={(e) => handleCostChange(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margem (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="99"
                    value={editingService.marginPercent?.toFixed(0) || ""}
                    onChange={(e) => handleMarginChange(parseFloat(e.target.value) || 0)}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Venda (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingService.unitValue?.toFixed(2) || ""}
                    onChange={(e) => handleUnitValueChange(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantidade Mínima (opcional)</Label>
                <Input
                  type="number"
                  value={editingService.minQuantity || ""}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      minQuantity: parseInt(e.target.value) || undefined,
                    })
                  }
                  placeholder="Deixe vazio se não houver"
                />
              </div>
              <div className="space-y-2">
                <Label>Instruções/Informações (opcional)</Label>
                <textarea
                  value={editingService.infoText || ""}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      infoText: e.target.value || undefined,
                    })
                  }
                  placeholder="Ex: Preparo do exame, contato do profissional, procedimentos especiais..."
                  className="w-full h-20 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              <Button className="w-full" onClick={handleSaveService} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para excluir */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Catálogo central — também acessível em /admin/laudos-servicos */}
      <LaudosServicosManager />
    </div>
  );
}
