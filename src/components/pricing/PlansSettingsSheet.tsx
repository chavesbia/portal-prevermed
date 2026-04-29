import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LifeRangesManager } from "@/components/admin/LifeRangesManager";
import { PricingPlansManager } from "@/components/admin/PricingPlansManager";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlansSettingsSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-6xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configuração - Planos</SheetTitle>
          <SheetDescription>
            Faixas de vida e tabela de valores por Plano × Faixa × Serviço.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-6">
          <LifeRangesManager />
          <PricingPlansManager />
        </div>
      </SheetContent>
    </Sheet>
  );
}
