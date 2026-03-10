import { useState } from "react";
import { Car, Hotel, Smartphone, Plus, Trash2, ReceiptText, Utensils, Package, Bus, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CustoAdicionalItem {
  id: string;
  descricao: string;
  valor: number;
}

export interface CustosAdicionaisData {
  kmTotal: number;
  kmCusto: number;
  alimentacao: number;
  hospedagem: number;
  transporteEquipamentos: number;
  aplicativo: number;
  outrosCustos: CustoAdicionalItem[];
  markupPercent: number;
}

interface CustosAdicionaisTabProps {
  custos: CustosAdicionaisData;
  onCustosChange: (custos: CustosAdicionaisData) => void;
  isAdmin?: boolean;
}

const initialCustosAdicionais: CustosAdicionaisData = {
  kmTotal: 0,
  kmCusto: 2.80,
  alimentacao: 0,
  hospedagem: 0,
  transporteEquipamentos: 0,
  aplicativo: 0,
  outrosCustos: [],
  markupPercent: 80,
};

export { initialCustosAdicionais };

export function CustosAdicionaisTab({
  custos,
  onCustosChange,
  isAdmin = false,
}: CustosAdicionaisTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const outrosCustosTotal = custos.outrosCustos.reduce((acc, item) => acc + item.valor, 0);

  const totalCusto =
    custos.kmTotal * custos.kmCusto +
    custos.alimentacao +
    custos.hospedagem +
    custos.transporteEquipamentos +
    custos.aplicativo +
    outrosCustosTotal;

  const totalVenda = totalCusto * (1 + custos.markupPercent / 100);
  const resultado = totalVenda - totalCusto;
  const margemPercent = totalVenda > 0 ? (resultado / totalVenda) * 100 : 0;

  const handleChange = (field: keyof CustosAdicionaisData, value: number | CustoAdicionalItem[]) => {
    onCustosChange({
      ...custos,
      [field]: value,
    });
  };

  const addOutroCusto = () => {
    const newItem: CustoAdicionalItem = {
      id: `outro-${Date.now()}`,
      descricao: "",
      valor: 0,
    };
    handleChange("outrosCustos", [...custos.outrosCustos, newItem]);
  };

  const updateOutroCusto = (id: string, field: keyof CustoAdicionalItem, value: string | number) => {
    const updated = custos.outrosCustos.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    handleChange("outrosCustos", updated);
  };

  const removeOutroCusto = (id: string) => {
    const updated = custos.outrosCustos.filter((item) => item.id !== id);
    handleChange("outrosCustos", updated);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Coluna Esquerda - Inputs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-info" />
            Custos de Deslocamento
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Custos editáveis - valor de venda calculado automaticamente
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* KM */}
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Car className="h-3 w-3" />
                Total KM
              </Label>
              <Input
                type="number"
                min={0}
                value={custos.kmTotal}
                onChange={(e) => handleChange("kmTotal", parseFloat(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Custo/KM (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={custos.kmCusto}
                onChange={(e) => handleChange("kmCusto", parseFloat(e.target.value) || 0)}
                className="h-8"
                disabled={!isAdmin}
              />
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground">Fixo: R$ 2,80</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Subtotal</p>
              <p className="text-xs font-medium">{formatCurrency(custos.kmTotal * custos.kmCusto)}</p>
            </div>
          </div>

          {/* Alimentação */}
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
                value={custos.alimentacao}
                onChange={(e) => handleChange("alimentacao", parseFloat(e.target.value) || 0)}
                className="h-8"
                placeholder="0,00"
              />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Custo</p>
              <p className="text-xs font-medium">{formatCurrency(custos.alimentacao)}</p>
            </div>
          </div>

          {/* Hospedagem */}
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
                value={custos.hospedagem}
                onChange={(e) => handleChange("hospedagem", parseFloat(e.target.value) || 0)}
                className="h-8"
                placeholder="0,00"
              />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Custo</p>
              <p className="text-xs font-medium">{formatCurrency(custos.hospedagem)}</p>
            </div>
          </div>

          {/* Transporte de Equipamentos */}
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
                value={custos.transporteEquipamentos}
                onChange={(e) => handleChange("transporteEquipamentos", parseFloat(e.target.value) || 0)}
                className="h-8"
                placeholder="0,00"
              />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Custo</p>
              <p className="text-xs font-medium">{formatCurrency(custos.transporteEquipamentos)}</p>
            </div>
          </div>

          {/* Uber/99 */}
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
                value={custos.aplicativo}
                onChange={(e) => handleChange("aplicativo", parseFloat(e.target.value) || 0)}
                className="h-8"
                placeholder="0,00"
              />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Custo</p>
              <p className="text-xs font-medium">{formatCurrency(custos.aplicativo)}</p>
            </div>
          </div>

          {/* Markup */}
          <div className="grid grid-cols-2 gap-2 items-end pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs">Markup (%)</Label>
              <Input
                type="number"
                min={0}
                max={200}
                value={custos.markupPercent}
                onChange={(e) => handleChange("markupPercent", parseFloat(e.target.value) || 0)}
                className="h-8"
                disabled={!isAdmin}
              />
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground">Somente admin pode alterar</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coluna Direita - Outros Custos e Resumo */}
      <div className="space-y-4">
        {/* Outros Custos */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ReceiptText className="h-4 w-4 text-info" />
                Outros Custos
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOutroCusto}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Materiais extras, passagens, pedágios, etc.
            </p>
          </CardHeader>
          <CardContent>
            {custos.outrosCustos.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                Clique em "Adicionar" para incluir outros custos
              </p>
            ) : (
              <div className="space-y-2">
                {custos.outrosCustos.map((item) => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={item.descricao}
                      onChange={(e) => updateOutroCusto(item.id, "descricao", e.target.value)}
                      className="h-8 text-xs flex-1"
                      placeholder="Descrição"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.valor}
                      onChange={(e) => updateOutroCusto(item.id, "valor", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs w-24"
                      placeholder="R$"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOutroCusto(item.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
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
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumo dos Custos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Custo Total</span>
              <span className="font-medium">{formatCurrency(totalCusto)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Valor de Venda (+{custos.markupPercent}%)
              </span>
              <span className="font-semibold text-primary">{formatCurrency(totalVenda)}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Resultado</span>
              <span
                className={cn(
                  "font-semibold",
                  resultado >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {formatCurrency(resultado)} ({margemPercent.toFixed(1)}%)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
