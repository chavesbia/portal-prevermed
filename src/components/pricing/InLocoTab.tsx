import { useState, useCallback, useEffect, useRef } from "react";
import { ServiceSelector } from "./ServiceSelector";
import { QuotationSummary } from "./QuotationSummary";
import { ServiceItem, QuotationItem, UserRole, DeslocamentoItem } from "@/types/pricing";
import { CustosAdicionaisData, initialCustosAdicionais } from "./CustosAdicionaisTab";
import { useQuotations } from "@/hooks/useQuotations";
import { toast } from "sonner";
import { EditingQuotation } from "@/pages/Index";
import { Button } from "@/components/ui/button";
import { X, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFormPersistence } from "@/hooks/useFormPersistence";

interface InLocoTabProps {
  services: ServiceItem[];
  userRole: UserRole;
  custosAdicionais: CustosAdicionaisData;
  onCustosChange: (custos: CustosAdicionaisData) => void;
  editingQuotation?: EditingQuotation | null;
  onClearEdit?: () => void;
}

export function InLocoTab({ 
  services, 
  userRole, 
  custosAdicionais, 
  onCustosChange,
  editingQuotation,
  onClearEdit 
}: InLocoTabProps) {
  const [selectedItems, setSelectedItems] = useState<QuotationItem[]>([]);
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountValue, setDiscountValue] = useState(0);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  
  const { saveQuotation, updateQuotation } = useQuotations();
  const { saveDraft, loadDraft, clearDraft, hasDraft, isRestored, setIsRestored } = useFormPersistence();
  const isInitialLoad = useRef(true);

  const isAdmin = userRole === "admin";
  const isEditing = !!editingQuotation;

  // Restaurar rascunho ao carregar (apenas se não estiver editando)
  useEffect(() => {
    if (!isEditing && isInitialLoad.current) {
      isInitialLoad.current = false;
      const draft = loadDraft();
      if (draft && (draft.selectedItems.length > 0 || draft.clientName)) {
        setSelectedItems(draft.selectedItems);
        setClientName(draft.clientName);
        setNotes(draft.notes);
        setDiscountPercent(draft.discountPercent);
        setDiscountValue(draft.discountValue);
        onCustosChange(draft.custosAdicionais);
        setShowDraftBanner(true);
        setIsRestored(true);
        toast.info("Rascunho restaurado", {
          description: "Seus dados em preenchimento foram recuperados",
        });
      }
    }
  }, [isEditing, loadDraft, onCustosChange, setIsRestored]);

  // Carregar dados quando entrar em modo de edição
  useEffect(() => {
    if (editingQuotation) {
      setClientName(editingQuotation.clientName);
      setNotes(editingQuotation.notes);
      setDiscountPercent(editingQuotation.discountPercent);
      setDiscountValue(editingQuotation.discountValue || 0);
      setSelectedItems(editingQuotation.items);
      clearDraft(); // Limpar rascunho ao editar
      setShowDraftBanner(false);
    }
  }, [editingQuotation, clearDraft]);

  // Auto-salvar rascunho quando dados mudam (apenas se não estiver editando)
  useEffect(() => {
    if (!isEditing && !isInitialLoad.current) {
      const hasData = selectedItems.length > 0 || clientName.trim() !== "";
      if (hasData) {
        saveDraft({
          selectedItems,
          clientName,
          notes,
          discountPercent,
          discountValue,
          custosAdicionais,
        });
      }
    }
  }, [selectedItems, clientName, notes, discountPercent, discountValue, custosAdicionais, isEditing, saveDraft]);

  // Filtrar serviços (excluir deslocamento que agora é tratado separadamente)
  const filteredServices = services.filter((s) => s.category !== "deslocamento");

  const handleItemChange = useCallback(
    (serviceId: string, quantity: number, customUnitValue?: number) => {
      const service = filteredServices.find((s) => s.id === serviceId);
      if (!service) return;

      setSelectedItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.serviceId === serviceId);
        const existingItem = existingIndex >= 0 ? prev[existingIndex] : null;

        if (quantity === 0) {
          return prev.filter((item) => item.serviceId !== serviceId);
        }

        // Usar valor customizado ou o valor padrão do serviço
        const unitValue = customUnitValue ?? existingItem?.customUnitValue ?? service.unitValue;
        const totalValue = quantity * unitValue;
        const totalCost = quantity * service.costValue;
        const result = totalValue - totalCost;
        const markup = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
        const resultPercent = totalValue > 0 ? (result / totalValue) * 100 : 0;

        const newItem: QuotationItem = {
          serviceId,
          quantity,
          unitValue: service.unitValue,
          customUnitValue: unitValue,
          totalValue,
          costValue: service.costValue,
          totalCost,
          markup,
          result,
          resultPercent,
        };

        if (existingIndex >= 0) {
          const newItems = [...prev];
          newItems[existingIndex] = newItem;
          return newItems;
        }

        return [...prev, newItem];
      });
    },
    [filteredServices]
  );

  // Converter custos adicionais para formato DeslocamentoItem (compatibilidade)
  const getDeslocamentoFromCustos = useCallback((): DeslocamentoItem => {
    const outrosCustos = custosAdicionais.outrosCustos.map(c => ({
      id: c.id,
      descricao: c.descricao,
      valor: c.valor
    }));

    // Adicionar alimentação e transporte de equipamentos como outros custos
    if (custosAdicionais.alimentacao > 0) {
      outrosCustos.push({
        id: 'alimentacao',
        descricao: 'Alimentação',
        valor: custosAdicionais.alimentacao
      });
    }
    if (custosAdicionais.transporteEquipamentos > 0) {
      outrosCustos.push({
        id: 'transporte-equip',
        descricao: 'Transporte Equipamentos',
        valor: custosAdicionais.transporteEquipamentos
      });
    }

    return {
      kmTotal: custosAdicionais.kmTotal,
      kmCusto: custosAdicionais.kmCusto,
      hospedagem: custosAdicionais.hospedagem,
      aplicativo: custosAdicionais.aplicativo,
      outrosCustos,
      markupPercent: custosAdicionais.markupPercent,
    };
  }, [custosAdicionais]);

  const resetForm = () => {
    setSelectedItems([]);
    setClientName("");
    setNotes("");
    setDiscountPercent(0);
    setDiscountValue(0);
    onCustosChange(initialCustosAdicionais);
    clearDraft();
    setShowDraftBanner(false);
    onClearEdit?.();
  };

  const handleDiscardDraft = () => {
    resetForm();
    toast.success("Rascunho descartado");
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) {
      toast.error("Por favor, informe o nome do cliente");
      return;
    }

    const deslocamento = getDeslocamentoFromCustos();
    const outrosCustosTotal = deslocamento.outrosCustos.reduce((acc, item) => acc + item.valor, 0);
    const deslocamentoCusto =
      deslocamento.kmTotal * deslocamento.kmCusto +
      deslocamento.hospedagem +
      deslocamento.aplicativo +
      outrosCustosTotal;
    const deslocamentoVenda = deslocamentoCusto * (1 + deslocamento.markupPercent / 100);

    const hasDeslocamento = deslocamentoCusto > 0;
    const hasItems = selectedItems.length > 0;

    if (!hasItems && !hasDeslocamento) {
      toast.error("Selecione ao menos um serviço ou adicione custos adicionais");
      return;
    }

    // Calculate totals
    const itemsTotalValue = selectedItems.reduce((acc, item) => acc + item.totalValue, 0);
    const itemsTotalCost = selectedItems.reduce((acc, item) => acc + item.totalCost, 0);
    const grandTotalValue = itemsTotalValue + deslocamentoVenda;
    const grandTotalCost = itemsTotalCost + deslocamentoCusto;
    
    // Calcular desconto combinado (percentual + valor fixo)
    const discountFromPercent = grandTotalValue * (discountPercent / 100);
    const totalDiscount = discountFromPercent + discountValue;
    const finalValue = grandTotalValue - totalDiscount;
    const marginPercent = finalValue > 0 ? ((finalValue - grandTotalCost) / finalValue) * 100 : 0;

    let success = false;

    if (isEditing && editingQuotation) {
      success = await updateQuotation({
        id: editingQuotation.id,
        clientName,
        notes,
        discountPercent,
        discountValue,
        items: selectedItems,
        custosAdicionais,
        totalValue: grandTotalValue,
        totalCost: grandTotalCost,
        marginPercent,
        isApprovedEdit: editingQuotation.isApprovedEdit,
        isRejectedEdit: editingQuotation.isRejectedEdit,
      });
    } else {
      success = await saveQuotation({
        clientName,
        notes,
        discountPercent,
        discountValue,
        items: selectedItems,
        custosAdicionais,
        totalValue: grandTotalValue,
        totalCost: grandTotalCost,
        marginPercent,
      });
    }

    if (success) {
      resetForm();
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner de rascunho restaurado */}
      {showDraftBanner && !isEditing && (
        <Alert className="border-info bg-info/10">
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm font-medium">
              <RotateCcw className="h-4 w-4 inline mr-2" />
              Rascunho restaurado automaticamente
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscardDraft}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Descartar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Banner de edição */}
      {isEditing && (
        <Alert className={`border-warning ${editingQuotation?.isApprovedEdit ? "bg-primary/10 border-primary" : editingQuotation?.isRejectedEdit ? "bg-destructive/10 border-destructive" : "bg-warning/10"}`}>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {editingQuotation?.isApprovedEdit ? (
                <>Editando MDC aprovado: <strong>{editingQuotation?.clientName}</strong> (nova versão será criada)</>
              ) : editingQuotation?.isRejectedEdit ? (
                <>Editando MDC rejeitado: <strong>{editingQuotation?.clientName}</strong> (voltará para aprovação)</>
              ) : (
                <>Editando memória de cálculo: <strong>{editingQuotation?.clientName}</strong></>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Cancelar Edição
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="animate-fade-in" style={{ animationDelay: "0ms" }}>
          <ServiceSelector
            services={filteredServices}
            selectedItems={selectedItems}
            onItemChange={handleItemChange}
            isAdmin={isAdmin}
            custosAdicionais={custosAdicionais}
            onCustosChange={onCustosChange}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <QuotationSummary
            items={selectedItems}
            services={filteredServices}
            deslocamento={getDeslocamentoFromCustos()}
            clientName={clientName}
            onClientNameChange={setClientName}
            notes={notes}
            onNotesChange={setNotes}
            discountPercent={discountPercent}
            onDiscountChange={setDiscountPercent}
            discountValue={discountValue}
            onDiscountValueChange={setDiscountValue}
            userRole={userRole}
            onSubmit={handleSubmit}
            isEditing={isEditing}
          />
        </div>
      </div>
    </div>
  );
}
