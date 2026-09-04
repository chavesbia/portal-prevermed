import { Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Send, Car, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuotationItem, ServiceItem, APPROVAL_LEVELS, UserRole, DeslocamentoItem } from "@/types/pricing";
import { cn } from "@/lib/utils";

interface QuotationSummaryProps {
  items: QuotationItem[];
  services: ServiceItem[];
  deslocamento?: DeslocamentoItem;
  clientName: string;
  onClientNameChange: (name: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  discountPercent: number;
  onDiscountChange: (discount: number) => void;
  discountValue: number;
  onDiscountValueChange: (value: number) => void;
  userRole: UserRole;
  onSubmit: () => void;
  isEditing?: boolean;
}

export function QuotationSummary({
  items,
  services,
  deslocamento,
  clientName,
  onClientNameChange,
  notes,
  onNotesChange,
  discountPercent,
  onDiscountChange,
  discountValue: discountFixedValue,
  onDiscountValueChange,
  userRole,
  onSubmit,
  isEditing = false,
}: QuotationSummaryProps) {
  const activeItems = items.filter((item) => item.quantity > 0);

  // Calcular deslocamento
  const outrosCustosTotal = deslocamento?.outrosCustos.reduce((acc, item) => acc + item.valor, 0) || 0;
  const deslocamentoCusto = deslocamento
    ? deslocamento.kmTotal * deslocamento.kmCusto +
      deslocamento.hospedagem +
      deslocamento.aplicativo +
      outrosCustosTotal
    : 0;
  const deslocamentoVenda = deslocamento
    ? deslocamentoCusto * (1 + deslocamento.markupPercent / 100)
    : 0;
  const hasDeslocamento = deslocamentoCusto > 0;

  const totals = activeItems.reduce(
    (acc, item) => ({
      totalValue: acc.totalValue + item.totalValue,
      totalCost: acc.totalCost + item.totalCost,
      totalResult: acc.totalResult + item.result,
    }),
    { totalValue: 0, totalCost: 0, totalResult: 0 }
  );

  // Incluir deslocamento nos totais
  const grandTotalValue = totals.totalValue + deslocamentoVenda;
  const grandTotalCost = totals.totalCost + deslocamentoCusto;

  // Calcular desconto combinado (percentual + valor fixo)
  const discountFromPercent = grandTotalValue * (discountPercent / 100);
  const totalDiscount = discountFromPercent + discountFixedValue;
  const finalValue = grandTotalValue - totalDiscount;
  const finalResult = finalValue - grandTotalCost;
  const marginPercent = finalValue > 0 ? (finalResult / finalValue) * 100 : 0;

  // Calcular percentual efetivo de desconto para validação de alçada
  const effectiveDiscountPercent = grandTotalValue > 0 
    ? (totalDiscount / grandTotalValue) * 100 
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Determinar nível de aprovação necessário (usa desconto efetivo)
  const getRequiredApprovalLevel = () => {
    if (effectiveDiscountPercent === 0 && marginPercent >= 30) {
      return null; // Não precisa de aprovação
    }

    const sortedLevels = [...APPROVAL_LEVELS].sort((a, b) => a.level - b.level);

    for (const level of sortedLevels) {
      if (effectiveDiscountPercent <= level.maxDiscount && marginPercent >= level.minMargin) {
        return level;
      }
    }

    return APPROVAL_LEVELS[APPROVAL_LEVELS.length - 1]; // Admin Master
  };

  const requiredLevel = getRequiredApprovalLevel();
  const currentUserLevel = APPROVAL_LEVELS.find((l) => l.approverRole === userRole);
  const canApprove = currentUserLevel && (!requiredLevel || currentUserLevel.level >= requiredLevel.level);

  const getServiceName = (serviceId: string) => {
    return services.find((s) => s.id === serviceId)?.description || serviceId;
  };

  const hasAnyItem = activeItems.length > 0 || hasDeslocamento;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          Resumo do Orçamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cliente */}
        <div className="space-y-1">
          <Label htmlFor="clientName" className="text-xs">Nome do Cliente</Label>
          <Input
            id="clientName"
            placeholder="Digite o nome do cliente"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Itens Selecionados */}
        {(activeItems.length > 0 || hasDeslocamento) && (
          <div className="space-y-1">
            <Label className="text-xs">Itens ({activeItems.length + (hasDeslocamento ? 1 : 0)})</Label>
            <div className="max-h-36 overflow-y-auto rounded-lg border bg-muted/30 p-2 custom-scrollbar">
              {activeItems.map((item) => (
                <div
                  key={item.serviceId}
                  className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {getServiceName(item.serviceId)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.quantity}x {formatCurrency(item.customUnitValue || item.unitValue)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold">{formatCurrency(item.totalValue)}</span>
                </div>
              ))}
              {hasDeslocamento && (
                <div className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate flex items-center gap-1">
                      <Car className="h-3 w-3" />
                      Custos Adicionais
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Custo: {formatCurrency(deslocamentoCusto)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold">{formatCurrency(deslocamentoVenda)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Desconto */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="discountPercent" className="text-xs">Desconto (%)</Label>
            <Input
              id="discountPercent"
              type="number"
              min={0}
              max={50}
              value={discountPercent}
              onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="discountValue" className="text-xs">Desconto (R$)</Label>
            <Input
              id="discountValue"
              type="number"
              min={0}
              value={discountFixedValue}
              onChange={(e) => onDiscountValueChange(parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
        </div>
        {totalDiscount > 0 && (
          <p className="text-[10px] text-destructive">
            Desconto total: - {formatCurrency(totalDiscount)}
            {discountPercent > 0 && discountFixedValue > 0 && (
              <span className="text-muted-foreground ml-1">
                ({discountPercent}% + {formatCurrency(discountFixedValue)})
              </span>
            )}
          </p>
        )}

        {/* Observações */}
        <div className="space-y-1">
          <Label htmlFor="notes" className="text-xs">Observações</Label>
          <Textarea
            id="notes"
            placeholder="Observações adicionais..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            className="text-xs"
          />
        </div>

        {/* Totais */}
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Subtotal Serviços</span>
            <span className="font-medium">{formatCurrency(totals.totalValue)}</span>
          </div>
          {hasDeslocamento && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Subtotal Custos Adicionais</span>
              <span className="font-medium">{formatCurrency(deslocamentoVenda)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs border-t pt-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(grandTotalValue)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex items-center justify-between text-xs text-destructive">
              <span>
                Desconto 
                {discountPercent > 0 && discountFixedValue > 0 
                  ? ` (${discountPercent}% + R$)` 
                  : discountPercent > 0 
                    ? ` (${discountPercent}%)` 
                    : " (R$)"}
              </span>
              <span>- {formatCurrency(totalDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-semibold text-sm">Total Final</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(finalValue)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Custo Total</span>
            <span className="text-muted-foreground">{formatCurrency(grandTotalCost)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Resultado</span>
            <div className="flex items-center gap-1">
              {finalResult >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span
                className={cn(
                  "font-semibold",
                  finalResult >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {formatCurrency(finalResult)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Margem</span>
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[10px]",
                marginPercent >= 30
                  ? "border-success/30 bg-success/10 text-success"
                  : marginPercent >= 20
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              {marginPercent.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Alçada de Aprovação */}
        {hasAnyItem && (
          <div
            className={cn(
              "rounded-lg border p-2",
              canApprove
                ? "border-success/30 bg-success/5"
                : "border-warning/30 bg-warning/5"
            )}
          >
            <div className="flex items-start gap-2">
              {canApprove ? (
                <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-medium">
                  {canApprove ? "Você pode liberar" : "Requer liberação superior"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {requiredLevel
                    ? `Nível: ${requiredLevel.name}`
                    : "Aprovação automática (margem ≥ 30%)"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Alerta de Desconto */}
        {totalDiscount > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                Atenção: Desconto de {effectiveDiscountPercent.toFixed(1)}% aplicado ({formatCurrency(totalDiscount)})
              </p>
            </div>
          </div>
        )}

        {/* Botão */}
        <Button
          className="w-full"
          size="sm"
          disabled={!hasAnyItem || !clientName.trim()}
          onClick={onSubmit}
          variant={isEditing ? "default" : "default"}
        >
          {isEditing ? (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar para Aprovação
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
