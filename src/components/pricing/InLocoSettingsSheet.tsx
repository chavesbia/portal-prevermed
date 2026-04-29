import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminTab } from "@/components/admin/AdminTab";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InLocoSettingsSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurações - In Loco</SheetTitle>
          <SheetDescription>
            Margem padrão e gerenciamento de exames e serviços usados nas memórias In Loco.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <AdminTab />
        </div>
      </SheetContent>
    </Sheet>
  );
}
