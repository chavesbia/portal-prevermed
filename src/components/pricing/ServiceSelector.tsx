import { useState, useMemo } from "react";
import { Plus, Minus, Search, AlertCircle, Star, Car, Hotel, Smartphone, Utensils, Package, ReceiptText, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ServiceItem, QuotationItem } from "@/types/pricing";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CustosAdicionaisData, CustoAdicionalItem } from "./CustosAdicionaisTab";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ServiceSelectorProps {
  services: ServiceItem[];
  selectedItems: QuotationItem[];
  onItemChange: (serviceId: string, quantity: number, customUnitValue?: number) => void;
  isAdmin?: boolean;
  custosAdicionais?: CustosAdicionaisData;
  onCustosChange?: (custos: CustosAdicionaisData) => void;
}

const FAVORITES_KEY = "prevermed_favorite_exams";

export function ServiceSelector({
  services,
  selectedItems,
  onItemChange,
  isAdmin = false,
  custosAdicionais,
  onCustosChange,
}: ServiceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("servico");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  // Mantém o texto enquanto o usuário digita (para permitir limpar o campo sem voltar para 0)
  const [unitValueDrafts, setUnitValueDrafts] = useState<Record<string, string>>({});
  
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const categories = [
    { id: "servico", label: "Serviços", color: "bg-primary/10 text-primary" },
    { id: "exame_complementar", label: "Exames", color: "bg-warning/10 text-warning" },
    { id: "custos_adicionais", label: "Custos Adicionais", color: "bg-info/10 text-info" },
  ];

  const toggleFavorite = (serviceId: string) => {
    const newFavorites = favorites.includes(serviceId)
      ? favorites.filter((id) => id !== serviceId)
      : [...favorites, serviceId];
    
    setFavorites(newFavorites);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
  };

  const filteredServices = useMemo(() => {
    if (activeCategory === "custos_adicionais") return [];
    
    let filtered = services.filter(
      (service) =>
        service.category === activeCategory &&
        service.category !== "deslocamento" &&
        (service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          service.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (showOnlyFavorites && activeCategory === "exame_complementar") {
      filtered = filtered.filter((service) => favorites.includes(service.id));
    }

    if (activeCategory === "exame_complementar") {
      filtered.sort((a, b) => {
        const aFav = favorites.includes(a.id);
        const bFav = favorites.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
      });
    }

    return filtered;
  }, [services, activeCategory, searchTerm, showOnlyFavorites, favorites]);

  const getSelectedItem = (serviceId: string) => {
    return selectedItems.find((i) => i.serviceId === serviceId);
  };

  const getSelectedQuantity = (serviceId: string) => {
    const item = getSelectedItem(serviceId);
    return item?.quantity || 0;
  };

  const getCustomUnitValue = (serviceId: string, defaultValue: number) => {
    const item = getSelectedItem(serviceId);
    return item?.customUnitValue ?? defaultValue;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleQuantityChange = (service: ServiceItem, newQuantity: number) => {
    if (service.minQuantity && newQuantity > 0 && newQuantity < service.minQuantity) {
      toast.warning(`Quantidade mínima: ${service.minQuantity}`, {
        description: "Use o campo de desconto para abatimentos.",
      });
      newQuantity = service.minQuantity;
    }

    const customValue = getCustomUnitValue(service.id, service.unitValue);
    onItemChange(service.id, newQuantity, customValue);
  };

  const handleUnitValueChange = (service: ServiceItem, newValue: number) => {
    const quantity = getSelectedQuantity(service.id);
    onItemChange(service.id, quantity, newValue);
  };

  const sanitizeMoneyInput = (raw: string) => {
    let sanitized = raw.replace(/[^\d,]/g, "");
    const parts = sanitized.split(",");
    if (parts.length > 2) {
      sanitized = parts[0] + "," + parts.slice(1).join("");
    }
    return sanitized;
  };

  const favoritesCount = favorites.length;

  // Custos Adicionais handlers
  const handleCustoChange = (field: keyof CustosAdicionaisData, value: number | CustoAdicionalItem[]) => {
    if (custosAdicionais && onCustosChange) {
      onCustosChange({
        ...custosAdicionais,
        [field]: value,
      });
    }
  };

  const addOutroCusto = () => {
    if (custosAdicionais && onCustosChange) {
      const newItem: CustoAdicionalItem = {
        id: `outro-${Date.now()}`,
        descricao: "",
        valor: 0,
      };
      handleCustoChange("outrosCustos", [...custosAdicionais.outrosCustos, newItem]);
    }
  };

  const updateOutroCusto = (id: string, field: keyof CustoAdicionalItem, value: string | number) => {
    if (custosAdicionais && onCustosChange) {
      const updated = custosAdicionais.outrosCustos.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      );
      handleCustoChange("outrosCustos", updated);
    }
  };

  const removeOutroCusto = (id: string) => {
    if (custosAdicionais && onCustosChange) {
      const updated = custosAdicionais.outrosCustos.filter((item) => item.id !== id);
      handleCustoChange("outrosCustos", updated);
    }
  };

  const outrosCustosTotal = custosAdicionais?.outrosCustos.reduce((acc, item) => acc + item.valor, 0) || 0;
  const totalCustosAdicionais = custosAdicionais
    ? custosAdicionais.kmTotal * custosAdicionais.kmCusto +
      custosAdicionais.alimentacao +
      custosAdicionais.hospedagem +
      custosAdicionais.transporteEquipamentos +
      custosAdicionais.aplicativo +
      outrosCustosTotal
    : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4 text-primary" />
          Selecionar Serviços e Exames
        </CardTitle>
        <div className="mt-2 flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setShowOnlyFavorites(false);
                }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium transition-all",
                  activeCategory === cat.id
                    ? cat.color + " ring-1 ring-offset-1 ring-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {cat.label}
                {cat.id === "custos_adicionais" && totalCustosAdicionais > 0 && (
                  <span className="ml-1 text-[10px]">({formatCurrency(totalCustosAdicionais)})</span>
                )}
              </button>
            ))}
            
            {activeCategory === "exame_complementar" && (
              <button
                onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium transition-all flex items-center gap-1",
                  showOnlyFavorites
                    ? "bg-yellow-100 text-yellow-700 ring-1 ring-offset-1 ring-yellow-200"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Star className={cn("h-3 w-3", showOnlyFavorites && "fill-yellow-500")} />
                Favoritos {favoritesCount > 0 && `(${favoritesCount})`}
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[400px] overflow-y-auto custom-scrollbar pt-2">
        {activeCategory === "custos_adicionais" && custosAdicionais && onCustosChange ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Car className="h-3 w-3" />
                  Total KM
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={custosAdicionais.kmTotal}
                  onChange={(e) => handleCustoChange("kmTotal", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Custo/KM (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={custosAdicionais.kmCusto}
                  onChange={(e) => handleCustoChange("kmCusto", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Subtotal</p>
                <p className="text-xs font-medium">{formatCurrency(custosAdicionais.kmTotal * custosAdicionais.kmCusto)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Utensils className="h-3 w-3" />
                  Alimentação
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={custosAdicionais.alimentacao}
                  onChange={(e) => handleCustoChange("alimentacao", parseFloat(e.target.value) || 0)}
                  className="h-8"
                  placeholder="0,00"
                />
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Custo</p>
                <p className="text-xs font-medium">{formatCurrency(custosAdicionais.alimentacao)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Hotel className="h-3 w-3" />
                  Hospedagem
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={custosAdicionais.hospedagem}
                  onChange={(e) => handleCustoChange("hospedagem", parseFloat(e.target.value) || 0)}
                  className="h-8"
                  placeholder="0,00"
                />
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Custo</p>
                <p className="text-xs font-medium">{formatCurrency(custosAdicionais.hospedagem)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Transporte Equipamentos
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={custosAdicionais.transporteEquipamentos}
                  onChange={(e) => handleCustoChange("transporteEquipamentos", parseFloat(e.target.value) || 0)}
                  className="h-8"
                  placeholder="0,00"
                />
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Custo</p>
                <p className="text-xs font-medium">{formatCurrency(custosAdicionais.transporteEquipamentos)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  Uber/99
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={custosAdicionais.aplicativo}
                  onChange={(e) => handleCustoChange("aplicativo", parseFloat(e.target.value) || 0)}
                  className="h-8"
                  placeholder="0,00"
                />
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Custo</p>
                <p className="text-xs font-medium">{formatCurrency(custosAdicionais.aplicativo)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Markup (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={custosAdicionais.markupPercent}
                  onChange={(e) => handleCustoChange("markupPercent", parseFloat(e.target.value) || 0)}
                  className="h-8"
                  disabled={!isAdmin}
                />
                {!isAdmin && (
                  <p className="text-[10px] text-muted-foreground">Somente admin pode alterar</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs flex items-center gap-1">
                  <ReceiptText className="h-3 w-3" />
                  Outros Custos
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOutroCusto}
                  className="h-6 text-xs px-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                Materiais extras, passagens, pedágios, etc.
              </p>
              {custosAdicionais.outrosCustos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  Clique em "Adicionar" para incluir outros custos
                </p>
              ) : (
                <div className="space-y-2">
                  {custosAdicionais.outrosCustos.map((item) => (
                    <div key={item.id} className="flex gap-2 items-center">
                      <Input
                        type="text"
                        value={item.descricao}
                        onChange={(e) => updateOutroCusto(item.id, "descricao", e.target.value)}
                        className="h-7 text-xs flex-1"
                        placeholder="Descrição"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.valor}
                        onChange={(e) => updateOutroCusto(item.id, "valor", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs w-20"
                        placeholder="R$"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOutroCusto(item.id)}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {outrosCustosTotal > 0 && (
                    <div className="text-right text-xs text-muted-foreground pt-2 border-t">
                      Subtotal: {formatCurrency(outrosCustosTotal)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Custo Total</span>
                <span className="font-medium">{formatCurrency(totalCustosAdicionais)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Valor de Venda (+{custosAdicionais.markupPercent}%)
                </span>
                <span className="font-semibold text-primary">
                  {formatCurrency(totalCustosAdicionais * (1 + custosAdicionais.markupPercent / 100))}
                </span>
              </div>
            </div>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {showOnlyFavorites
              ? "Nenhum exame favorito encontrado. Clique na ⭐ para favoritar."
              : "Nenhum item encontrado."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredServices.map((service) => {
              const quantity = getSelectedQuantity(service.id);
              const isSelected = quantity > 0;
              const customUnitValue = getCustomUnitValue(service.id, service.unitValue);
              const isFavorite = favorites.includes(service.id);
              const draftValue = unitValueDrafts[service.id];
              const displayUnitValue =
                draftValue ?? customUnitValue.toFixed(2).replace(".", ",");

              return (
                <div
                  key={service.id}
                  className={cn(
                    "rounded-lg border p-2 transition-all duration-200",
                    isSelected
                      ? "border-primary/30 bg-primary/5"
                      : "border-border hover:border-primary/20 hover:bg-muted/50"
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {activeCategory === "exame_complementar" && (
                            <button
                              onClick={() => toggleFavorite(service.id)}
                              className="p-0.5 hover:scale-110 transition-transform"
                              title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                            >
                              <Star
                                className={cn(
                                  "h-4 w-4",
                                  isFavorite
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground hover:text-yellow-400"
                                )}
                              />
                            </button>
                          )}
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {service.code}
                          </Badge>
                          {service.minQuantity && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              Mín. {service.minQuantity}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium leading-tight flex items-center gap-1">
                          {service.description}
                          {service.infoText && (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-info cursor-help shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs whitespace-pre-wrap">{service.infoText}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">Valor Venda</p>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={displayUnitValue}
                            onChange={(e) => {
                              const next = sanitizeMoneyInput(e.target.value);
                              setUnitValueDrafts((prev) => ({ ...prev, [service.id]: next }));

                              // Se o usuário limpou o campo, não forçar 0 (mantém o valor anterior até ele digitar um novo)
                              if (next === "") return;

                              const parsed = parseFloat(next.replace(",", "."));
                              if (!Number.isNaN(parsed)) {
                                handleUnitValueChange(service, parsed);
                              }
                            }}
                            onBlur={() => {
                              const draft = unitValueDrafts[service.id];
                              
                              // Limpar draft ao sair do campo
                              setUnitValueDrafts((prev) => {
                                const { [service.id]: _removed, ...rest } = prev;
                                return rest;
                              });

                              // Se ficou vazio ou inválido, restaura o valor anterior
                              if (!draft || draft === "") {
                                return;
                              }

                              let parsed = parseFloat(draft.replace(",", "."));
                              
                              // Validar: não pode ser menor que o custo
                              if (!Number.isNaN(parsed) && parsed < service.costValue) {
                                toast.warning("Valor abaixo do custo", {
                                  description: `O valor de venda não pode ser menor que o custo (${formatCurrency(service.costValue)})`,
                                });
                                parsed = service.costValue;
                              }

                              if (!Number.isNaN(parsed)) {
                                handleUnitValueChange(service, parsed);
                              }
                            }}
                            className="h-7 w-24 text-xs"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">Custo</p>
                          <div className="h-7 px-2 flex items-center text-xs text-muted-foreground bg-muted rounded">
                            {formatCurrency(service.costValue)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const newQty = Math.max(0, quantity - 1);
                            if (service.minQuantity && newQty > 0 && newQty < service.minQuantity) {
                              handleQuantityChange(service, 0);
                            } else {
                              handleQuantityChange(service, newQty);
                            }
                          }}
                          disabled={quantity === 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            handleQuantityChange(service, val);
                          }}
                          className="h-8 w-16 text-center"
                          min={0}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const newQty = quantity === 0 && service.minQuantity
                              ? service.minQuantity
                              : quantity + 1;
                            handleQuantityChange(service, newQty);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {service.minQuantity && isSelected && quantity < service.minQuantity && (
                      <div className="flex items-center gap-1 text-warning text-xs">
                        <AlertCircle className="h-3 w-3" />
                        <span>Quantidade mínima não atingida</span>
                      </div>
                    )}

                    {isSelected && (
                      <div className="flex justify-between items-center pt-1 border-t text-xs">
                        <span className="text-muted-foreground">
                          {quantity}x {formatCurrency(customUnitValue)}
                        </span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(quantity * customUnitValue)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}