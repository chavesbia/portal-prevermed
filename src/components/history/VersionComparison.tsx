import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GitCompare, Loader2, ArrowRight, Plus, Minus, Equal } from "lucide-react";
import { initialServices } from "@/data/services";
import { QuotationItem } from "@/types/pricing";
import { CustosAdicionaisData } from "@/components/pricing/CustosAdicionaisTab";

interface QuotationVersion {
  id: string;
  version_number: number;
  client_name: string;
  total_value: number;
  total_cost: number;
  margin_percent: number;
  discount_percent: number | null;
  notes: string | null;
  created_at: string;
  created_by: string;
  items: QuotationItem[];
  custos_adicionais: CustosAdicionaisData;
  creator_name?: string;
}

interface VersionComparisonProps {
  quotationId: string;
  currentVersion: {
    version_number: number;
    client_name: string;
    total_value: number;
    total_cost: number;
    margin_percent: number;
    discount_percent: number;
    notes: string | null;
    items: QuotationItem[];
    custos_adicionais: CustosAdicionaisData;
    created_at: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionComparison({ quotationId, currentVersion, open, onOpenChange }: VersionComparisonProps) {
  const [versions, setVersions] = useState<QuotationVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<QuotationVersion | null>(null);

  useEffect(() => {
    if (open && quotationId) {
      fetchVersions();
    }
  }, [open, quotationId]);

  useEffect(() => {
    if (selectedVersionId) {
      const version = versions.find(v => v.id === selectedVersionId);
      setSelectedVersion(version || null);
    } else {
      setSelectedVersion(null);
    }
  }, [selectedVersionId, versions]);

  const fetchVersions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("quotation_versions")
        .select("*")
        .eq("quotation_id", quotationId)
        .order("version_number", { ascending: false });

      if (error) throw error;

      const versionsWithNames = await Promise.all(
        (data || []).map(async (v) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", v.created_by)
            .maybeSingle();

          const itemsData = (v.items as unknown as QuotationItem[]) || [];
          const custosData = v.custos_adicionais as unknown as Partial<CustosAdicionaisData>;
          
          const fullCustos: CustosAdicionaisData = {
            kmTotal: custosData?.kmTotal ?? 0,
            kmCusto: custosData?.kmCusto ?? 2.80,
            alimentacao: custosData?.alimentacao ?? 0,
            hospedagem: custosData?.hospedagem ?? 0,
            transporteEquipamentos: custosData?.transporteEquipamentos ?? 0,
            aplicativo: custosData?.aplicativo ?? 0,
            outrosCustos: custosData?.outrosCustos ?? [],
            markupPercent: custosData?.markupPercent ?? 30,
          };

          return {
            ...v,
            items: itemsData,
            custos_adicionais: fullCustos,
            creator_name: profile?.full_name || "-",
          };
        })
      );

      setVersions(versionsWithNames);
      if (versionsWithNames.length > 0) {
        setSelectedVersionId(versionsWithNames[0].id);
      }
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getServiceName = (serviceId: string) => {
    const service = initialServices.find(s => s.id === serviceId);
    return service?.description || serviceId;
  };

  const getValueChange = (oldVal: number, newVal: number) => {
    if (oldVal === newVal) return { type: "equal", diff: 0 };
    if (newVal > oldVal) return { type: "increase", diff: newVal - oldVal };
    return { type: "decrease", diff: oldVal - newVal };
  };

  const renderValueChange = (oldVal: number, newVal: number, isCurrency = true) => {
    const change = getValueChange(oldVal, newVal);
    const formatVal = isCurrency ? formatCurrency : (v: number) => `${v.toFixed(1)}%`;
    
    if (change.type === "equal") {
      return (
        <span className="text-muted-foreground flex items-center gap-1">
          <Equal className="h-3 w-3" />
          {formatVal(newVal)}
        </span>
      );
    }
    
    if (change.type === "increase") {
      return (
        <span className="text-success flex items-center gap-1">
          <Plus className="h-3 w-3" />
          {formatVal(newVal)}
          <span className="text-xs opacity-70">(+{formatVal(change.diff)})</span>
        </span>
      );
    }
    
    return (
      <span className="text-destructive flex items-center gap-1">
        <Minus className="h-3 w-3" />
        {formatVal(newVal)}
        <span className="text-xs opacity-70">(-{formatVal(change.diff)})</span>
      </span>
    );
  };

  const getItemChanges = () => {
    if (!selectedVersion) return { added: [], removed: [], changed: [], unchanged: [] };

    const oldItems = selectedVersion.items || [];
    const newItems = currentVersion.items || [];
    
    const oldItemMap = new Map(oldItems.map(i => [i.serviceId, i]));
    const newItemMap = new Map(newItems.map(i => [i.serviceId, i]));

    const added: QuotationItem[] = [];
    const removed: QuotationItem[] = [];
    const changed: { old: QuotationItem; new: QuotationItem }[] = [];
    const unchanged: QuotationItem[] = [];

    // Find removed and changed
    oldItems.forEach(oldItem => {
      const newItem = newItemMap.get(oldItem.serviceId);
      if (!newItem) {
        removed.push(oldItem);
      } else if (
        oldItem.quantity !== newItem.quantity ||
        (oldItem.customUnitValue || oldItem.unitValue) !== (newItem.customUnitValue || newItem.unitValue)
      ) {
        changed.push({ old: oldItem, new: newItem });
      } else {
        unchanged.push(newItem);
      }
    });

    // Find added
    newItems.forEach(newItem => {
      if (!oldItemMap.has(newItem.serviceId)) {
        added.push(newItem);
      }
    });

    return { added, removed, changed, unchanged };
  };

  const getCustosChanges = () => {
    if (!selectedVersion) return [];

    const oldCustos = selectedVersion.custos_adicionais || {} as CustosAdicionaisData;
    const newCustos = currentVersion.custos_adicionais || {} as CustosAdicionaisData;

    const changes: { field: string; oldVal: number; newVal: number }[] = [];

    const fields = [
      { key: 'kmTotal', label: 'KM Total' },
      { key: 'kmCusto', label: 'Custo por KM' },
      { key: 'hospedagem', label: 'Hospedagem' },
      { key: 'aplicativo', label: 'Uber/99' },
      { key: 'alimentacao', label: 'Alimentação' },
      { key: 'transporteEquipamentos', label: 'Transporte Equipamentos' },
      { key: 'markupPercent', label: 'Markup (%)' },
    ];

    fields.forEach(({ key, label }) => {
      const oldVal = oldCustos[key as keyof CustosAdicionaisData];
      const newVal = newCustos[key as keyof CustosAdicionaisData];
      const oldNum = typeof oldVal === 'number' ? oldVal : 0;
      const newNum = typeof newVal === 'number' ? newVal : 0;
      if (oldNum !== newNum) {
        changes.push({ field: label, oldVal: oldNum, newVal: newNum });
      }
    });

    return changes;
  };

  const itemChanges = getItemChanges();
  const custosChanges = getCustosChanges();
  const hasChanges = itemChanges.added.length > 0 || 
                     itemChanges.removed.length > 0 || 
                     itemChanges.changed.length > 0 || 
                     custosChanges.length > 0 ||
                     selectedVersion?.client_name !== currentVersion.client_name ||
                     selectedVersion?.discount_percent !== currentVersion.discount_percent ||
                     selectedVersion?.notes !== currentVersion.notes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Comparar Versões
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma versão anterior encontrada para comparar
          </div>
        ) : (
          <div className="space-y-4">
            {/* Version selector */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground">Versão Anterior</label>
                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma versão" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version_number} - {format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground mt-6" />
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground">Versão Atual</label>
                <div className="mt-1 h-10 px-3 py-2 border rounded-md bg-background flex items-center">
                  v{currentVersion.version_number} - {format(new Date(currentVersion.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>

            {selectedVersion && (
              <ScrollArea className="max-h-[50vh] pr-4">
                {!hasChanges ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma alteração encontrada entre as versões
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary changes */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Resumo Financeiro</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Valor Total</p>
                          {renderValueChange(selectedVersion.total_value, currentVersion.total_value)}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Custo Total</p>
                          {renderValueChange(selectedVersion.total_cost, currentVersion.total_cost)}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Margem</p>
                          {renderValueChange(selectedVersion.margin_percent, currentVersion.margin_percent, false)}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Desconto</p>
                          {renderValueChange(selectedVersion.discount_percent || 0, currentVersion.discount_percent || 0, false)}
                        </div>
                      </div>
                    </div>

                    {/* Client name change */}
                    {selectedVersion.client_name !== currentVersion.client_name && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Nome do Cliente</h4>
                        <div className="p-3 bg-muted/30 rounded-lg text-sm flex items-center gap-2">
                          <span className="line-through text-muted-foreground">{selectedVersion.client_name}</span>
                          <ArrowRight className="h-4 w-4" />
                          <span className="font-medium">{currentVersion.client_name}</span>
                        </div>
                      </div>
                    )}

                    {/* Added items */}
                    {itemChanges.added.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Plus className="h-4 w-4 text-success" />
                          Itens Adicionados ({itemChanges.added.length})
                        </h4>
                        <div className="space-y-1">
                          {itemChanges.added.map((item) => (
                            <div key={item.serviceId} className="p-2 bg-success/10 border border-success/20 rounded text-sm flex justify-between">
                              <span>{getServiceName(item.serviceId)}</span>
                              <span>Qtd: {item.quantity} | {formatCurrency(item.totalValue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Removed items */}
                    {itemChanges.removed.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Minus className="h-4 w-4 text-destructive" />
                          Itens Removidos ({itemChanges.removed.length})
                        </h4>
                        <div className="space-y-1">
                          {itemChanges.removed.map((item) => (
                            <div key={item.serviceId} className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm flex justify-between line-through opacity-70">
                              <span>{getServiceName(item.serviceId)}</span>
                              <span>Qtd: {item.quantity} | {formatCurrency(item.totalValue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Changed items */}
                    {itemChanges.changed.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <GitCompare className="h-4 w-4 text-warning" />
                          Itens Alterados ({itemChanges.changed.length})
                        </h4>
                        <div className="space-y-2">
                          {itemChanges.changed.map(({ old, new: newItem }) => (
                            <div key={old.serviceId} className="p-3 bg-warning/10 border border-warning/20 rounded text-sm">
                              <p className="font-medium mb-2">{getServiceName(old.serviceId)}</p>
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                {old.quantity !== newItem.quantity && (
                                  <div>
                                    <span className="text-muted-foreground">Quantidade: </span>
                                    <span className="line-through text-muted-foreground">{old.quantity}</span>
                                    <ArrowRight className="h-3 w-3 inline mx-1" />
                                    <span className="font-medium">{newItem.quantity}</span>
                                  </div>
                                )}
                                {(old.customUnitValue || old.unitValue) !== (newItem.customUnitValue || newItem.unitValue) && (
                                  <div>
                                    <span className="text-muted-foreground">Valor Unit.: </span>
                                    <span className="line-through text-muted-foreground">{formatCurrency(old.customUnitValue || old.unitValue)}</span>
                                    <ArrowRight className="h-3 w-3 inline mx-1" />
                                    <span className="font-medium">{formatCurrency(newItem.customUnitValue || newItem.unitValue)}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">Total: </span>
                                  {renderValueChange(old.totalValue, newItem.totalValue)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custos adicionais changes */}
                    {custosChanges.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Alterações em Custos Adicionais</h4>
                        <div className="space-y-1">
                          {custosChanges.map((change) => (
                            <div key={change.field} className="p-2 bg-muted/30 rounded text-sm flex items-center gap-2">
                              <span className="font-medium w-40">{change.field}:</span>
                              <span className="line-through text-muted-foreground">
                                {change.field.includes('%') ? `${change.oldVal}%` : formatCurrency(change.oldVal)}
                              </span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="font-medium">
                                {change.field.includes('%') ? `${change.newVal}%` : formatCurrency(change.newVal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes change */}
                    {selectedVersion.notes !== currentVersion.notes && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Observações</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-muted/30 rounded text-sm">
                            <p className="text-xs text-muted-foreground mb-1">Anterior</p>
                            <p className="text-muted-foreground">{selectedVersion.notes || "(vazio)"}</p>
                          </div>
                          <div className="p-3 bg-muted/30 rounded text-sm">
                            <p className="text-xs text-muted-foreground mb-1">Atual</p>
                            <p>{currentVersion.notes || "(vazio)"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}