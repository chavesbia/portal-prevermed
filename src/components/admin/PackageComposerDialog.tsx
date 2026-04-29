import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { CatalogService } from "@/hooks/useCatalogServices";
import {
  ITEM_TYPE_LABELS,
  PackageItemType,
  useServicePackageItems,
} from "@/hooks/useServicePackages";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentService: CatalogService | null;
  allServices: CatalogService[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

export function PackageComposerDialog({
  open,
  onOpenChange,
  parentService,
  allServices,
}: Props) {
  const { isAdmMaster } = useAuth();
  const { items, isLoading, upsert, remove } = useServicePackageItems(
    parentService?.id || null
  );

  const [serviceId, setServiceId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [unitValue, setUnitValue] = useState("");
  const [itemType, setItemType] = useState<PackageItemType>("NOVO");

  const eligible = useMemo(
    () =>
      allServices.filter(
        (s) =>
          s.is_active &&
          s.package_eligible &&
          s.id !== parentService?.id &&
          !items.some((i) => i.service_id === s.id)
      ),
    [allServices, items, parentService]
  );

  const lookup = useMemo(() => {
    const m = new Map<string, CatalogService>();
    allServices.forEach((s) => m.set(s.id, s));
    return m;
  }, [allServices]);

  const total = items.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_value || 0),
    0
  );

  const handleAdd = async () => {
    if (!parentService || !serviceId) return;
    await upsert.mutateAsync({
      package_id: parentService.id,
      service_id: serviceId,
      quantity: Number(quantity) || 1,
      unit_value: unitValue ? Number(unitValue) : null,
      item_type: itemType,
    });
    setServiceId("");
    setQuantity("1");
    setUnitValue("");
    setItemType("NOVO");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Composição do pacote: {parentService ? titleCase(parentService.name) : ""}
          </DialogTitle>
          <DialogDescription>
            Defina quais serviços do catálogo compõem esse pacote, com quantidade e valor
            unitário. Esses dados alimentam memória de cálculo em Renovação, Proposta e
            Contrato.
          </DialogDescription>
        </DialogHeader>

        {isAdmMaster && (
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-12">
            <div className="space-y-1 md:col-span-5">
              <Label className="text-xs">Serviço</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Nenhum serviço elegível disponível.
                    </div>
                  ) : (
                    eligible.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {titleCase(s.name)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Qtd</Label>
              <Input
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Valor unit.</Label>
              <Input
                type="number"
                step="0.01"
                value={unitValue}
                onChange={(e) => setUnitValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={itemType}
                onValueChange={(v) => setItemType(v as PackageItemType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOVO">Novo</SelectItem>
                  <SelectItem value="RENOVACAO">Renovação</SelectItem>
                  <SelectItem value="AMBOS">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end md:col-span-1">
              <Button
                onClick={handleAdd}
                disabled={!serviceId || upsert.isPending}
                size="icon"
                className="w-full"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-[400px] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nenhum item adicionado a esse pacote.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => {
                    const svc = lookup.get(it.service_id);
                    const subtotal =
                      Number(it.quantity || 0) * Number(it.unit_value || 0);
                    return (
                      <TableRow key={it.id}>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {svc ? titleCase(svc.name) : "—"}
                          </div>
                          {svc && (
                            <div className="text-xs text-muted-foreground">
                              {svc.category}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ITEM_TYPE_LABELS[it.item_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {Number(it.quantity).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {it.unit_value != null ? fmt(Number(it.unit_value)) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {fmt(subtotal)}
                        </TableCell>
                        <TableCell>
                          {isAdmMaster && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => remove.mutate(it.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/40">
                    <td colSpan={4} className="px-4 py-2 text-right text-sm font-medium">
                      Total do pacote
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">{fmt(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
