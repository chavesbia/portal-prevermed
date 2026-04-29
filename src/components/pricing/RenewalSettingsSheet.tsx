import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LaudosServicosManager } from "@/components/admin/LaudosServicosManager";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenewalSettingsSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configuração - Renovação</SheetTitle>
          <SheetDescription>
            Catálogo central de Laudos e Serviços. Reutilizado em Renovação, Proposta, Contrato, OS e Faturamento.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <LaudosServicosManager />
        </div>
      </SheetContent>
    </Sheet>
  );
}
