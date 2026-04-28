import { useEffect, useMemo, useState } from "react";
import { useCommercialClients } from "@/hooks/useCommercialClients";
import { useCommercialServices, useClientServices, useClientServiceModules, usePackageComponents } from "@/hooks/useCommercialServices";
import {
  useRenewalQuotations,
  RenewalIndexType,
  RenewalItem,
  totalsFromItems,
  deviation,
} from "@/hooks/useRenewalQuotations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trash2, Plus, Calculator, Info, Package2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Link } from "react-router-dom";

// shadcn checkbox isn't exported by default in some templates; ensure import
// (já existe em src/components/ui/checkbox)

// Tabela de referência baseada na PlansTab — Plano B (Pacote Vidas)
const PLAN_TIERS = [
  { range: "1 A 5", max: 5, ltcat: 650, pgr: 550, drps: 600, pcmso: 300, vida: 18 },
  { range: "6 A 10", max: 10, ltcat: 780, pgr: 660, drps: 750, pcmso: 360, vida: 16 },
  { range: "11 A 20", max: 20, ltcat: 910, pgr: 770, drps: 900, pcmso: 420, vida: 14 },
  { range: "21 A 30", max: 30, ltcat: 1040, pgr: 880, drps: 1350, pcmso: 480, vida: 12.5 },
  { range: "31 A 50", max: 50, ltcat: 1300, pgr: 1100, drps: 1500, pcmso: 600, vida: 10.5 },
  { range: "51+", max: 99999, ltcat: 1500, pgr: 1200, drps: 1700, pcmso: 690, vida: 15 },
];

function getTier(lives: number) {
  return PLAN_TIERS.find((t) => lives <= t.max) ?? PLAN_TIERS[PLAN_TIERS.length - 1];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

interface DraftItem extends RenewalItem {
  _key: string;
}

const newItem = (overrides: Partial<DraftItem> = {}): DraftItem => ({
  _key: crypto.randomUUID(),
  service_id: null,
  service_name: "",
  current_value: 0,
  applied_percent: 0,
  adjusted_value: 0,
  reference_value: 0,
  is_included: true,
  in_monthly_package: false,
  observation: "",
  ...overrides,
});

const NO_SERVICE = "__manual__";

export function RenewalForm({ onSaved }: { onSaved?: () => void }) {
  const { clients } = useCommercialClients();
  const { services: catalog } = useCommercialServices();
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

  const { clientServices } = useClientServices(clientId || undefined);
  const { modules: clientModules } = useClientServiceModules(clientId || undefined);

  const priceableCatalog = useMemo(
    () => catalog.filter((s) => s.is_active && s.is_priceable),
    [catalog]
  );

  const tier = useMemo(() => getTier(currentLives || 0), [currentLives]);

  // referência: vidas * vida + laudos
  const referenceMonthly = useMemo(() => {
    if (!currentLives) return 0;
    const vidas = currentLives * tier.vida;
    const laudos = (tier.ltcat + tier.pgr + tier.drps + tier.pcmso) / 12;
    return vidas + laudos;
  }, [currentLives, tier]);

  // Quando muda o cliente, auto-importa os serviços contratados (Carteira + módulos do pacote)
  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (c) {
      setClientName(c.company_name);
      setCurrentLives(c.active_lives || 0);
    }
  }, [clientId, clients]);

  useEffect(() => {
    if (!clientId) return;
    if (clientServices.length === 0 && clientModules.length === 0) return;

    // Monta lista única de serviços do cliente: serviços diretamente vinculados + componentes ativos de pacotes
    const seen = new Set<string>();
    const imported: DraftItem[] = [];

    clientServices.forEach((cs) => {
      if (!cs.service || seen.has(cs.service.id)) return;
      seen.add(cs.service.id);
      const suggested = cs.service.price_in_plan ?? cs.service.price_standalone ?? 0;
      imported.push(
        newItem({
          service_id: cs.service.id,
          service_name: cs.service.name,
          current_value: suggested,
          adjusted_value: suggested,
          reference_value: cs.service.price_in_plan ?? cs.service.price_standalone ?? 0,
          in_monthly_package: !!cs.service.is_package,
        })
      );
    });

    // Adiciona componentes de pacote marcados como ativos
    clientModules
      .filter((m) => m.is_active)
      .forEach((m) => {
        if (seen.has(m.component_id)) return;
        const svc = catalog.find((s) => s.id === m.component_id);
        if (!svc) return;
        seen.add(svc.id);
        imported.push(
          newItem({
            service_id: svc.id,
            service_name: svc.name,
            current_value: 0,
            in_monthly_package: true,
            observation: "Componente do pacote contratado",
          })
        );
      });

    if (imported.length > 0) {
      setItems(imported);
      toast.success(`${imported.length} serviço(s) importado(s) da carteira do cliente`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clientServices.length, clientModules.length]);

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it._key !== key) return it;
        const next = { ...it, ...patch };
        next.adjusted_value = +(next.current_value * (1 + (next.applied_percent || 0) / 100)).toFixed(2);
        return next;
      })
    );
  };

  const handlePickService = (key: string, serviceId: string) => {
    if (serviceId === NO_SERVICE) {
      updateItem(key, { service_id: null });
      return;
    }
    const svc = priceableCatalog.find((s) => s.id === serviceId);
    if (!svc) return;
    const suggested = svc.price_in_plan ?? svc.price_standalone ?? 0;
    setItems((prev) =>
      prev.map((it) =>
        it._key === key
          ? {
              ...it,
              service_id: svc.id,
              service_name: svc.name,
              current_value: it.current_value || suggested,
              reference_value: svc.price_in_plan ?? svc.price_standalone ?? 0,
              adjusted_value: +((it.current_value || suggested) * (1 + (it.applied_percent || 0) / 100)).toFixed(2),
              in_monthly_package: it.in_monthly_package ?? !!svc.is_package,
            }
          : it
      )
    );
  };

  const applyGlobalIndex = () => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        applied_percent: indexPercent,
        adjusted_value: +(it.current_value * (1 + indexPercent / 100)).toFixed(2),
      }))
    );
    toast.success(`${indexType} ${indexPercent}% aplicado em todos os serviços`);
  };

  const totals = useMemo(() => totalsFromItems(items), [items]);
  const dev = useMemo(
    () => deviation(totals.adjusted_total_monthly, referenceMonthly),
    [totals, referenceMonthly]
  );

  const needsJustification = dev.deviation_status !== "igual" && Math.abs(dev.deviation_percent) > 1;

  const handleSubmit = async () => {
    if (!clientName.trim()) return toast.error("Selecione um cliente");
    if (currentLives <= 0) return toast.error("Informe a quantidade de vidas atuais");
    if (items.every((i) => i.current_value === 0))
      return toast.error("Informe ao menos um serviço com valor");
    if (needsJustification && !justification.trim())
      return toast.error("Informe uma justificativa — valor está fora do padrão");

    const validItems: RenewalItem[] = items
      .filter((i) => i.current_value > 0 || (i.service_name && i.service_name.trim()))
      .map((i, idx) => ({
        service_id: i.service_id ?? null,
        service_name: (i.service_name || "").toUpperCase(),
        current_value: i.current_value,
        applied_percent: i.applied_percent,
        adjusted_value: i.adjusted_value,
        reference_value: i.reference_value,
        is_included: i.is_included !== false,
        in_monthly_package: i.in_monthly_package === true,
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
      items: validItems,
      reference_total_monthly: referenceMonthly,
      justification: justification || undefined,
      notes: notes || undefined,
    });

    // reset
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
    dev.deviation_status === "abaixo"
      ? "text-destructive"
      : dev.deviation_status === "acima"
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
            Selecione o cliente da Carteira — os serviços já contratados serão importados
            automaticamente. Use o seletor para adicionar serviços extras do{" "}
            <Link to="/admin/servicos-operacionais" className="text-primary underline">
              catálogo central
            </Link>
            .
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
              <Select value={indexType} onValueChange={(v) => setIndexType(v as RenewalIndexType)}>
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

          {currentLives > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Faixa de referência: <strong>{tier.range} vidas</strong> · R$ {tier.vida}/vida ·
                Valor padrão estimado: <strong>{fmt(referenceMonthly)}/mês</strong>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Serviços</CardTitle>
            <CardDescription>
              Selecione do catálogo, marque o que está dentro do pacote mensal e ajuste valores.
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
                  <TableHead className="min-w-[260px]">Serviço (catálogo)</TableHead>
                  <TableHead className="text-center w-[110px]">No pacote SST?</TableHead>
                  <TableHead className="text-right">Valor atual</TableHead>
                  <TableHead className="text-right w-[100px]">% aplic.</TableHead>
                  <TableHead className="text-right">Reajustado</TableHead>
                  <TableHead className="min-w-[180px]">Observações</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const linkedSvc = it.service_id
                    ? catalog.find((s) => s.id === it.service_id)
                    : null;
                  return (
                    <TableRow key={it._key}>
                      <TableCell>
                        <Select
                          value={it.service_id || NO_SERVICE}
                          onValueChange={(v) => handlePickService(it._key, v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecionar serviço..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_SERVICE}>
                              <span className="text-muted-foreground">— Digitar manualmente —</span>
                            </SelectItem>
                            {priceableCatalog.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <div className="flex items-center gap-2">
                                  {s.is_package && <Package2 className="h-3 w-3 text-primary" />}
                                  <span>{titleCase(s.name)}</span>
                                  {s.category && (
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      {titleCase(s.category)}
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!it.service_id && (
                          <Input
                            value={it.service_name}
                            onChange={(e) => updateItem(it._key, { service_name: e.target.value })}
                            placeholder="Nome do serviço (manual)"
                            className="h-8 mt-1"
                          />
                        )}
                        {linkedSvc && (linkedSvc.price_in_plan != null || linkedSvc.price_standalone != null) && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            Sugestão: avulso {fmt(linkedSvc.price_standalone ?? 0)} · plano{" "}
                            {fmt(linkedSvc.price_in_plan ?? 0)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={!!it.in_monthly_package}
                          onCheckedChange={(v) =>
                            updateItem(it._key, { in_monthly_package: v === true })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.current_value || ""}
                          onChange={(e) =>
                            updateItem(it._key, { current_value: Number(e.target.value) || 0 })
                          }
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.applied_percent || ""}
                          onChange={(e) =>
                            updateItem(it._key, { applied_percent: Number(e.target.value) || 0 })
                          }
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(it.adjusted_value)}</TableCell>
                      <TableCell>
                        <Input
                          value={it.observation || ""}
                          onChange={(e) => updateItem(it._key, { observation: e.target.value })}
                          placeholder="Notas específicas desta linha"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setItems((p) => p.filter((x) => x._key !== it._key))}
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
          {priceableCatalog.length === 0 && (
            <Alert className="mt-3">
              <Info className="h-4 w-4" />
              <AlertDescription>
                O catálogo de serviços está vazio. Cadastre serviços em{" "}
                <Link to="/admin/servicos-operacionais" className="text-primary underline">
                  Administração › Serviços Operacionais
                </Link>{" "}
                para selecioná-los aqui.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total atual (mensal)</CardDescription>
            <CardTitle className="text-xl">{fmt(totals.current_total_monthly)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
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
          <CardContent className="text-sm text-muted-foreground">
            Anual: {fmt(totals.adjusted_total_annual)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comparação vs padrão</CardDescription>
            <CardTitle className={`text-xl ${devColor}`}>
              {dev.deviation_percent > 0 ? "+" : ""}
              {dev.deviation_percent.toFixed(2)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                dev.deviation_status === "abaixo"
                  ? "destructive"
                  : dev.deviation_status === "acima"
                  ? "default"
                  : "secondary"
              }
            >
              {dev.deviation_status.toUpperCase()} do padrão
            </Badge>
            <div className="text-xs text-muted-foreground mt-1">
              Padrão: {fmt(referenceMonthly)}/mês
            </div>
          </CardContent>
        </Card>
      </div>

      {needsJustification && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            O valor reajustado está <strong>{dev.deviation_status}</strong> do padrão. É obrigatório
            informar uma justificativa para aprovação.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="space-y-2">
            <Label>Justificativa {needsJustification && <span className="text-destructive">*</span>}</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Justifique o reajuste se estiver fora do padrão"
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
            <Button
              onClick={handleSubmit}
              disabled={saveRenewal.isPending}
              size="lg"
            >
              {saveRenewal.isPending ? "Salvando..." : "Salvar Renovação"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
