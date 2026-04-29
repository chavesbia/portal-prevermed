import { useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Layers3, Loader2, Pencil, Plus, Save, Star } from "lucide-react";
import {
  BILLING_LABELS,
  BillingModel,
  PricingPlan,
  usePlanServicePrices,
  usePricingPlans,
} from "@/hooks/usePricingPlans";
import { useLifeRanges } from "@/hooks/useLifeRanges";
import { useCatalogServices } from "@/hooks/useCatalogServices";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface DraftPlan {
  id?: string;
  code: string;
  name: string;
  description: string;
  billing_model: BillingModel;
  display_order: string;
  is_recommended: boolean;
}

const emptyPlan = (): DraftPlan => ({
  code: "",
  name: "",
  description: "",
  billing_model: "PACOTE_VIDAS",
  display_order: "0",
  is_recommended: false,
});

export function PricingPlansManager() {
  const { isAdmMaster } = useAuth();
  const { plans, isLoading, upsertPlan, removePlan } = usePricingPlans();
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPlan>(emptyPlan());

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || plans[0],
    [plans, activePlanId]
  );

  const startCreatePlan = () => {
    setDraft(emptyPlan());
    setPlanDialogOpen(true);
  };

  const startEditPlan = (p: PricingPlan) => {
    setDraft({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description || "",
      billing_model: p.billing_model,
      display_order: String(p.display_order),
      is_recommended: p.is_recommended,
    });
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!draft.code.trim() || !draft.name.trim()) return;
    await upsertPlan.mutateAsync({
      id: draft.id,
      code: draft.code,
      name: draft.name,
      description: draft.description || null,
      billing_model: draft.billing_model,
      display_order: Number(draft.display_order) || 0,
      is_recommended: draft.is_recommended,
      is_active: true,
    });
    setPlanDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-primary" />
              Planos e Memória de Cálculo
            </CardTitle>
            <CardDescription>
              Configure planos comerciais e os preços por serviço × faixa de vida.
            </CardDescription>
          </div>
          {isAdmMaster && (
            <Button onClick={startCreatePlan} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Plano
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum plano cadastrado.
          </p>
        ) : (
          <Tabs
            value={activePlan?.id}
            onValueChange={setActivePlanId}
            className="w-full"
          >
            <TabsList className="flex flex-wrap h-auto gap-1">
              {plans.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="gap-2">
                  {p.is_recommended && <Star className="h-3 w-3 text-success" />}
                  <span className="font-mono text-xs">{p.code}</span>
                  <span>{p.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {plans.map((p) => (
              <TabsContent key={p.id} value={p.id} className="space-y-4 pt-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{BILLING_LABELS[p.billing_model]}</Badge>
                    {p.is_recommended && (
                      <Badge className="bg-success/15 text-success border-success/30">
                        Recomendado
                      </Badge>
                    )}
                    {p.description && (
                      <span className="text-sm text-muted-foreground">
                        {p.description}
                      </span>
                    )}
                  </div>
                  {isAdmMaster && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditPlan(p)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" /> Editar plano
                      </Button>
                    </div>
                  )}
                </div>
                <PriceMatrix planId={p.id} canEdit={!!isAdmMaster} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>

      {/* Dialog Plano */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>
              Defina o modelo de cobrança. Os preços são editados na matriz abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="A, B, C..."
              />
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input
                type="number"
                value={draft.display_order}
                onChange={(e) => setDraft({ ...draft, display_order: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Nome *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex.: Plano B - Pacote Vidas"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Modelo de cobrança</Label>
              <Select
                value={draft.billing_model}
                onValueChange={(v) =>
                  setDraft({ ...draft, billing_model: v as BillingModel })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVULSO">Avulso</SelectItem>
                  <SelectItem value="PACOTE_VIDAS">Pacote por Vidas</SelectItem>
                  <SelectItem value="POR_ASO">Por ASO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 text-sm col-span-2">
              <Checkbox
                checked={draft.is_recommended}
                onCheckedChange={(v) =>
                  setDraft({ ...draft, is_recommended: v === true })
                }
              />
              Marcar como recomendado
            </label>
          </div>
          <DialogFooter>
            {draft.id && (
              <Button
                variant="outline"
                className="mr-auto text-destructive"
                onClick={async () => {
                  if (!draft.id) return;
                  await removePlan.mutateAsync(draft.id);
                  setPlanDialogOpen(false);
                }}
              >
                Inativar
              </Button>
            )}
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePlan} disabled={upsertPlan.isPending}>
              {upsertPlan.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============================================================
// Matriz editável: Serviços (linhas) × Faixas de vida (colunas)
// =============================================================
function PriceMatrix({ planId, canEdit }: { planId: string; canEdit: boolean }) {
  const { activeServices, isLoading: loadingSvc } = useCatalogServices();
  const { activeRanges, isLoading: loadingRanges } = useLifeRanges();
  const { prices, isLoading: loadingPrices, upsertPrice, removePrice } =
    usePlanServicePrices(planId);

  // local edits buffer keyed by service|range
  const [edits, setEdits] = useState<
    Record<string, { price?: string; inc?: boolean; id?: string; saving?: boolean }>
  >({});

  const key = (svcId: string, rangeId: string | null) =>
    `${svcId}|${rangeId || "ALL"}`;

  const getCurrent = (svcId: string, rangeId: string | null) => {
    return prices.find(
      (pr) =>
        pr.catalog_service_id === svcId &&
        (pr.life_range_id || null) === rangeId
    );
  };

  const setEdit = (k: string, patch: Partial<{ price: string; inc: boolean; id: string }>) => {
    setEdits((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  };

  const saveCell = async (svcId: string, rangeId: string | null) => {
    const k = key(svcId, rangeId);
    const cur = getCurrent(svcId, rangeId);
    const buf = edits[k] || {};
    const priceStr = buf.price ?? (cur?.price?.toString() ?? "");
    const inc = buf.inc ?? cur?.is_included_in_package ?? false;
    if (priceStr === "" && !cur) return;
    setEdit(k, { ...buf, ...{ price: priceStr } });
    try {
      setEdits((prev) => ({ ...prev, [k]: { ...prev[k], saving: true } }));
      await upsertPrice.mutateAsync({
        plan_id: planId,
        catalog_service_id: svcId,
        life_range_id: rangeId,
        price: Number(priceStr) || 0,
        is_included_in_package: inc,
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    } catch {
      setEdits((prev) => ({ ...prev, [k]: { ...prev[k], saving: false } }));
    }
  };

  if (loadingSvc || loadingRanges || loadingPrices) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (activeServices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Cadastre serviços no catálogo de "Laudos e Serviços" para começar.
      </p>
    );
  }

  // Colunas: faixas + uma coluna "Padrão" para serviços que não dependem de faixa
  const columns: { id: string | null; label: string }[] = [
    { id: null, label: "Padrão" },
    ...activeRanges.map((r) => ({ id: r.id, label: r.label })),
  ];

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader className="bg-muted/30 sticky top-0">
          <TableRow>
            <TableHead className="min-w-[220px] sticky left-0 bg-muted/30 z-10">
              Serviço
            </TableHead>
            {columns.map((c) => (
              <TableHead key={c.label} className="text-center min-w-[140px]">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeServices.map((svc) => (
            <TableRow key={svc.id}>
              <TableCell className="sticky left-0 bg-background z-10">
                <div className="font-medium text-sm">{svc.name}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {svc.category} · {svc.area}
                  {svc.reference_value != null && ` · ref ${fmt(svc.reference_value)}`}
                </div>
              </TableCell>
              {columns.map((c) => {
                const k = key(svc.id, c.id);
                const cur = getCurrent(svc.id, c.id);
                const buf = edits[k];
                const priceVal = buf?.price ?? (cur?.price?.toString() ?? "");
                const inc = buf?.inc ?? cur?.is_included_in_package ?? false;
                const dirty = !!buf;

                return (
                  <TableCell key={k} className="align-top">
                    <div className="space-y-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={priceVal}
                        disabled={!canEdit}
                        onChange={(e) => setEdit(k, { price: e.target.value })}
                        placeholder="—"
                        className="h-8 text-right"
                      />
                      <label className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Checkbox
                            checked={inc}
                            disabled={!canEdit}
                            onCheckedChange={(v) =>
                              setEdit(k, { inc: v === true })
                            }
                            className="h-3 w-3"
                          />
                          Incluso
                        </span>
                        {canEdit && dirty && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => saveCell(svc.id, c.id)}
                            disabled={buf?.saving}
                          >
                            {buf?.saving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        {canEdit && cur && !dirty && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removePrice.mutate(cur.id)}
                            title="Remover preço"
                          >
                            ×
                          </Button>
                        )}
                      </label>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
