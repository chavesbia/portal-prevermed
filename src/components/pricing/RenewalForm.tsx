import { useEffect, useMemo, useState } from "react";
import { useCommercialClients } from "@/hooks/useCommercialClients";
import { useCatalogServices, CatalogService } from "@/hooks/useCatalogServices";
import {
  useRenewalQuotations,
  RenewalIndexType,
  RenewalItem,
} from "@/hooks/useRenewalQuotations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, Calculator, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

interface DraftItem {
  _key: string;
  catalog_service_id: string | null;
  service_name: string;
  quantity: number;
  unit_value: number;
  applied_percent: number;
  in_monthly_package: boolean;
  reference_value: number;
  observation: string;
}

const newItem = (overrides: Partial<DraftItem> = {}): DraftItem => ({
  _key: crypto.randomUUID(),
  catalog_service_id: null,
  service_name: "",
  quantity: 1,
  unit_value: 0,
  applied_percent: 0,
  in_monthly_package: false,
  reference_value: 0,
  observation: "",
  ...overrides,
});

// Quando o item está "incluso no pacote mensal", o valor é diluído em 12 parcelas
// para refletir o pagamento mensal dentro do pacote SST.
const monthlyDivisor = (it: DraftItem) => (it.in_monthly_package ? 12 : 1);

const lineCurrentTotal = (it: DraftItem) =>
  +((it.quantity * it.unit_value) / monthlyDivisor(it)).toFixed(2);
const lineAdjustedTotal = (it: DraftItem) =>
  +(lineCurrentTotal(it) * (1 + (it.applied_percent || 0) / 100)).toFixed(2);
const lineReferenceTotal = (it: DraftItem) =>
  +((it.quantity * it.reference_value) / monthlyDivisor(it)).toFixed(2);

const compareLine = (it: DraftItem): "ACIMA" | "IGUAL" | "ABAIXO" | null => {
  const ref = lineReferenceTotal(it);
  if (!ref) return null;
  const adj = lineAdjustedTotal(it);
  const dev = ((adj - ref) / ref) * 100;
  if (dev > 1) return "ACIMA";
  if (dev < -1) return "ABAIXO";
  return "IGUAL";
};

export function RenewalForm({ onSaved }: { onSaved?: () => void }) {
  const { clients } = useCommercialClients();
  const { activeServices: catalog, categories, isLoading: loadingCatalog } =
    useCatalogServices();
  const { saveRenewal } = useRenewalQuotations();

  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [currentLives, setCurrentLives] = useState<number>(0);
  const [indexType, setIndexType] = useState<RenewalIndexType>("IGPM");
  const [indexPercent, setIndexPercent] = useState<number>(0);
  const [referencePeriod, setReferencePeriod] = useState<string>("");
  const [items, setItems] = useState<DraftItem[]>([newItem()]);
  const [justification, setJustification] = useState("");
  const [notes, setNotes] = useState("");

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, CatalogService[]> = {};
    catalog.forEach((s) => {
      const key = s.category || "Outros";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [catalog]);

  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (c) {
      setClientName(c.company_name);
      setCurrentLives(c.active_lives || 0);
    }
  }, [clientId, clients]);

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  };

  const handlePickService = (key: string, serviceId: string) => {
    const svc = catalog.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) =>
      prev.map((it) =>
        it._key === key
          ? {
              ...it,
              catalog_service_id: svc.id,
              service_name: svc.name,
              unit_value: it.unit_value || svc.reference_value || 0,
              reference_value: svc.reference_value || 0,
            }
          : it
      )
    );
  };

  const applyGlobalIndex = () => {
    setItems((prev) => prev.map((it) => ({ ...it, applied_percent: indexPercent })));
    toast.success(`${indexType} ${indexPercent}% aplicado em todos os serviços`);
  };

  const totals = useMemo(() => {
    const current = items.reduce((acc, it) => acc + lineCurrentTotal(it), 0);
    const adjusted = items.reduce((acc, it) => acc + lineAdjustedTotal(it), 0);
    const reference = items.reduce((acc, it) => acc + lineReferenceTotal(it), 0);
    return {
      current_total_monthly: current,
      current_total_annual: current * 12,
      adjusted_total_monthly: adjusted,
      adjusted_total_annual: adjusted * 12,
      reference_total_monthly: reference,
    };
  }, [items]);

  const dev = useMemo(() => {
    if (!totals.reference_total_monthly)
      return { deviation_percent: 0, deviation_status: "IGUAL" as const };
    const d =
      ((totals.adjusted_total_monthly - totals.reference_total_monthly) /
        totals.reference_total_monthly) *
      100;
    let status: "ACIMA" | "IGUAL" | "ABAIXO" = "IGUAL";
    if (d > 1) status = "ACIMA";
    else if (d < -1) status = "ABAIXO";
    return { deviation_percent: Number(d.toFixed(2)), deviation_status: status };
  }, [totals]);

  // Justificativa obrigatória APENAS quando reajustado < referência
  const needsJustification = dev.deviation_status === "ABAIXO";

  const handleSubmit = async () => {
    if (!clientName.trim()) return toast.error("Selecione um cliente");
    if (currentLives <= 0) return toast.error("Informe a quantidade de vidas atuais");
    const validItems = items.filter((i) => i.catalog_service_id && i.quantity > 0);
    if (validItems.length === 0)
      return toast.error("Adicione ao menos um serviço do catálogo com quantidade");
    if (needsJustification && !justification.trim())
      return toast.error("Justificativa obrigatória — valor reajustado abaixo do padrão");

    const itemsForApi: RenewalItem[] = validItems.map((i, idx) => ({
      service_id: i.catalog_service_id,
      service_name: i.service_name.toUpperCase(),
      current_value: lineCurrentTotal(i),
      applied_percent: i.applied_percent,
      adjusted_value: lineAdjustedTotal(i),
      reference_value: lineReferenceTotal(i),
      is_included: true,
      in_monthly_package: i.in_monthly_package,
      observation: i.observation || null,
      sort_order: idx,
    }));

    await saveRenewal.mutateAsync({
      client_id: clientId || null,
      client_name: clientName,
      current_lives: currentLives,
      index_type: indexType,
      index_percent: indexPercent,
      reference_period: referencePeriod,
      items: itemsForApi,
      reference_total_monthly: totals.reference_total_monthly,
      justification: justification || undefined,
      notes: notes || undefined,
    });

    setClientId("");
    setClientName("");
    setCurrentLives(0);
    setIndexPercent(0);
    setReferencePeriod("");
    setItems([newItem()]);
    setJustification("");
    setNotes("");
    onSaved?.();
  };

  const devColor =
    dev.deviation_status === "ABAIXO"
      ? "text-destructive"
      : dev.deviation_status === "ACIMA"
      ? "text-success"
      : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Memória de Cálculo de Renovação
          </CardTitle>
          <CardDescription>
            Selecione o cliente da Carteira e adicione serviços do catálogo{" "}
            <strong>Laudos e Serviços</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label>Cliente da Carteira</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vidas atuais</Label>
              <Input
                type="number"
                min={0}
                value={currentLives}
                onChange={(e) => setCurrentLives(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Período de referência</Label>
              <Input
                placeholder="Ex.: 2025"
                value={referencePeriod}
                onChange={(e) => setReferencePeriod(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 items-end">
            <div className="space-y-2">
              <Label>Índice</Label>
              <Select
                value={indexType}
                onValueChange={(v) => setIndexType(v as RenewalIndexType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IGPM">IGPM</SelectItem>
                  <SelectItem value="IPCA">IPCA</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Percentual padrão (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={indexPercent}
                onChange={(e) => setIndexPercent(Number(e.target.value) || 0)}
              />
            </div>
            <Button onClick={applyGlobalIndex} variant="outline" className="gap-2">
              <Calculator className="h-4 w-4" />
              Aplicar em todos
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Serviços</CardTitle>
            <CardDescription>
              Selecione do catálogo Laudos e Serviços. Marque os que estão inclusos no
              pacote mensal.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setItems((p) => [...p, newItem()])}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Serviço *</TableHead>
                  <TableHead className="text-right w-[80px]">Qtd</TableHead>
                  <TableHead className="text-center w-[110px]">Incluso no pacote</TableHead>
                  <TableHead className="text-right w-[120px]">Valor unitário</TableHead>
                  <TableHead className="text-right w-[120px]">Valor total</TableHead>
                  <TableHead className="text-right w-[90px]">% aplicado</TableHead>
                  <TableHead className="text-right w-[130px]">Reajustado</TableHead>
                  <TableHead className="text-center w-[110px]">vs Ref.</TableHead>
                  <TableHead className="min-w-[160px]">Observações</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const cmp = compareLine(it);
                  return (
                    <TableRow key={it._key}>
                      <TableCell>
                        <Select
                          value={it.catalog_service_id || ""}
                          onValueChange={(v) => handlePickService(it._key, v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecionar do catálogo..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[320px]">
                            {Object.entries(groupedCatalog).map(([cat, list]) => (
                              <div key={cat}>
                                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/40">
                                  {cat}
                                </div>
                                {list.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    <span className="uppercase">{s.name}</span>
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.quantity || ""}
                          onChange={(e) =>
                            updateItem(it._key, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={it.in_monthly_package}
                          onCheckedChange={(v) =>
                            updateItem(it._key, { in_monthly_package: v === true })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.unit_value || ""}
                          onChange={(e) =>
                            updateItem(it._key, {
                              unit_value: Number(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(lineCurrentTotal(it))}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.applied_percent || ""}
                          onChange={(e) =>
                            updateItem(it._key, {
                              applied_percent: Number(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(lineAdjustedTotal(it))}
                      </TableCell>
                      <TableCell className="text-center">
                        {cmp && (
                          <Badge
                            variant={
                              cmp === "ABAIXO"
                                ? "destructive"
                                : cmp === "ACIMA"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {cmp}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={it.observation}
                          onChange={(e) =>
                            updateItem(it._key, { observation: e.target.value })
                          }
                          placeholder="Notas"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setItems((p) => p.filter((x) => x._key !== it._key))
                          }
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {!loadingCatalog && catalog.length === 0 && (
            <Alert className="mt-3">
              <Info className="h-4 w-4" />
              <AlertDescription>
                O catálogo Laudos e Serviços está vazio. Cadastre os serviços em{" "}
                <strong>Administração → Laudos e Serviços</strong> ou na aba{" "}
                <strong>Admin</strong> deste módulo.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total atual (mensal)</CardDescription>
            <CardTitle className="text-xl">{fmt(totals.current_total_monthly)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Anual: {fmt(totals.current_total_annual)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total reajustado (mensal)</CardDescription>
            <CardTitle className="text-xl text-primary">
              {fmt(totals.adjusted_total_monthly)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Anual: {fmt(totals.adjusted_total_annual)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valor de referência</CardDescription>
            <CardTitle className="text-xl">{fmt(totals.reference_total_monthly)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Soma dos valores de referência do catálogo.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comparação</CardDescription>
            <CardTitle className={`text-xl ${devColor}`}>
              {dev.deviation_percent > 0 ? "+" : ""}
              {dev.deviation_percent.toFixed(2)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                dev.deviation_status === "ABAIXO"
                  ? "destructive"
                  : dev.deviation_status === "ACIMA"
                  ? "default"
                  : "secondary"
              }
            >
              {dev.deviation_status} do padrão
            </Badge>
          </CardContent>
        </Card>
      </div>

      {needsJustification && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            O valor reajustado está <strong>abaixo</strong> do valor de referência. É
            obrigatório informar uma justificativa para aprovação.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="space-y-2">
            <Label>
              Justificativa{" "}
              {needsJustification && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Justifique o reajuste se estiver abaixo do padrão"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações gerais</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais"
              rows={2}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={saveRenewal.isPending} size="lg">
              {saveRenewal.isPending ? "Salvando..." : "Salvar Renovação"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
