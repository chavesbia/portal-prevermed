import { useMemo, useState } from "react";
import { Package, Users, FileText, Calculator, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePricingPlans, usePlanServicePrices } from "@/hooks/usePricingPlans";
import { useLifeRanges } from "@/hooks/useLifeRanges";
import { useCatalogServices } from "@/hooks/useCatalogServices";

const FALLBACK_MATRIX = [
  { maxLives: 5, ltcat: 650, pgr: 550, drps: 600, pcmso: 300, vida: 18, aso: 45, mensageria: 8 },
  { maxLives: 10, ltcat: 780, pgr: 660, drps: 750, pcmso: 360, vida: 16, aso: 45, mensageria: 8 },
  { maxLives: 20, ltcat: 910, pgr: 770, drps: 900, pcmso: 420, vida: 14, aso: 45, mensageria: 8 },
  { maxLives: 30, ltcat: 1040, pgr: 880, drps: 1350, pcmso: 480, vida: 12.5, aso: 45, mensageria: 8 },
  { maxLives: 50, ltcat: 1300, pgr: 1100, drps: 1500, pcmso: 600, vida: 10.5, aso: 45, mensageria: 8 },
  { maxLives: Number.POSITIVE_INFINITY, ltcat: 1500, pgr: 1200, drps: 1700, pcmso: 690, vida: 15, aso: 55, mensageria: 8 },
];

const PLAN_META: Record<
  string,
  { colorClass: string; features: string[] }
> = {
  A: {
    colorClass: "text-primary",
    features: ["ASO + Mensageria (eSocial)", "Laudos separados", "Sem desconto por volume"],
  },
  B: {
    colorClass: "text-success",
    features: ["Desconto por volume", "Laudos inclusos no pacote", "Ideal para empresas médias"],
  },
  C: {
    colorClass: "text-info",
    features: ["Pagamento por uso", "Flexibilidade total", "Ideal para turnover alto"],
  },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const tokenizeText = (value: string | null | undefined) =>
  normalizeText(value).split(/[^A-Z0-9]+/).filter(Boolean);

const getFallbackValues = (numLives: number) =>
  FALLBACK_MATRIX.find((item) => numLives <= item.maxLives) ?? FALLBACK_MATRIX[FALLBACK_MATRIX.length - 1];

function PlansTabLoading() {
  return (
    <div className="space-y-6">
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora de Planos
          </CardTitle>
          <CardDescription>Informe a quantidade de vidas para simular os valores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PlansTab() {
  const [lives, setLives] = useState(10);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("B");

  const { activePlans, isLoading: plansLoading } = usePricingPlans();
  const { activeRanges, isLoading: rangesLoading } = useLifeRanges();
  const { activeServices, isLoading: servicesLoading } = useCatalogServices();

  const selectedPlan = useMemo(
    () =>
      activePlans.find((plan) => plan.code === selectedPlanCode) ??
      activePlans.find((plan) => plan.is_recommended) ??
      activePlans[0],
    [activePlans, selectedPlanCode]
  );

  const packagePlan = useMemo(
    () =>
      activePlans.find((plan) => plan.code === "B") ??
      activePlans.find((plan) => plan.billing_model === "PACOTE_VIDAS") ??
      activePlans[0],
    [activePlans]
  );

  const {
    prices: selectedPlanPrices,
    isLoading: selectedPlanPricesLoading,
  } = usePlanServicePrices(selectedPlan?.id);

  const {
    prices: packagePlanPrices,
    isLoading: packagePlanPricesLoading,
  } = usePlanServicePrices(packagePlan?.id);

  const matchedServices = useMemo(() => {
    const hasToken = (name: string | null | undefined, token: string) => tokenizeText(name).includes(token);
    const includesText = (name: string | null | undefined, terms: string[]) => {
      const normalized = normalizeText(name);
      return terms.some((term) => normalized.includes(term));
    };

    const ltcat = activeServices.find((service) => hasToken(service.name, "LTCAT"));
    const pgr = activeServices.find((service) => hasToken(service.name, "PGR"));
    const drps = activeServices.find((service) => hasToken(service.name, "DRPS"));
    const pcmso = activeServices.find((service) => hasToken(service.name, "PCMSO"));
    const aso = activeServices.find((service) => hasToken(service.name, "ASO"));
    const mensageria = activeServices.find((service) =>
      includesText(service.name, ["MENSAGERIA", "ESOCIAL", "E SOCIAL", "E-SOCIAL"])
    );
    const vidaTerms = [
      "VIDA ATIVA",
      "PACOTE VIDA",
      "PACOTE VIDAS",
      "GESTAO VIDA",
      "GESTAO VIDAS",
      "VALOR POR VIDA",
      "POR VIDA",
      "VIDAS",
    ];
    const vida =
      activeServices.find(
        (service) =>
          (service.package_eligible || service.service_type === "RECORRENTE") &&
          includesText(service.name, vidaTerms)
      ) ?? activeServices.find((service) => includesText(service.name, vidaTerms));

    return { ltcat, pgr, drps, pcmso, aso, mensageria, vida };
  }, [activeServices]);

  const selectedPriceMap = useMemo(() => {
    return new Map(
      selectedPlanPrices.map((item) => [`${item.catalog_service_id}|${item.life_range_id ?? "ALL"}`, Number(item.price ?? 0)])
    );
  }, [selectedPlanPrices]);

  const packagePriceMap = useMemo(() => {
    return new Map(
      packagePlanPrices.map((item) => [`${item.catalog_service_id}|${item.life_range_id ?? "ALL"}`, Number(item.price ?? 0)])
    );
  }, [packagePlanPrices]);

  const getTier = useMemo(() => {
    return activeRanges.find(
      (range) => lives >= range.min_lives && (range.max_lives === null || lives <= range.max_lives)
    ) ?? null;
  }, [activeRanges, lives]);

  const getServicePrice = (
    priceMap: Map<string, number>,
    serviceId: string | undefined,
    lifeRangeId: string | null,
    serviceFallback: number,
    livesFallback: number
  ) => {
    if (!serviceId) return serviceFallback || livesFallback;
    const exact = priceMap.get(`${serviceId}|${lifeRangeId ?? "ALL"}`);
    if (exact != null) return exact;
    const defaultPrice = priceMap.get(`${serviceId}|ALL`);
    if (defaultPrice != null) return defaultPrice;
    return serviceFallback || livesFallback;
  };

  const currentTierValues = useMemo(() => {
    const fallback = getFallbackValues(lives);

    return {
      ltcat: getServicePrice(
        selectedPriceMap,
        matchedServices.ltcat?.id,
        getTier?.id ?? null,
        matchedServices.ltcat?.reference_value ?? 0,
        fallback.ltcat
      ),
      pgr: getServicePrice(
        selectedPriceMap,
        matchedServices.pgr?.id,
        getTier?.id ?? null,
        matchedServices.pgr?.reference_value ?? 0,
        fallback.pgr
      ),
      drps: getServicePrice(
        selectedPriceMap,
        matchedServices.drps?.id,
        getTier?.id ?? null,
        matchedServices.drps?.reference_value ?? 0,
        fallback.drps
      ),
      pcmso: getServicePrice(
        selectedPriceMap,
        matchedServices.pcmso?.id,
        getTier?.id ?? null,
        matchedServices.pcmso?.reference_value ?? 0,
        fallback.pcmso
      ),
      aso: getServicePrice(
        selectedPriceMap,
        matchedServices.aso?.id,
        getTier?.id ?? null,
        matchedServices.aso?.reference_value ?? 0,
        fallback.aso
      ),
      mensageria: getServicePrice(
        selectedPriceMap,
        matchedServices.mensageria?.id,
        getTier?.id ?? null,
        matchedServices.mensageria?.reference_value ?? 0,
        fallback.mensageria
      ),
      vida: getServicePrice(
        selectedPriceMap,
        matchedServices.vida?.id,
        getTier?.id ?? null,
        matchedServices.vida?.reference_value ?? 0,
        fallback.vida
      ),
    };
  }, [getTier, lives, matchedServices, selectedPriceMap]);

  const planTiers = useMemo(() => {
    const sourceRanges =
      activeRanges.length > 0
        ? activeRanges.map((range) => ({
            key: range.id,
            label: range.label,
            minLives: range.min_lives,
            maxLives: range.max_lives,
            lifeRangeId: range.id,
          }))
        : [
            {
              key: "default",
              label: "Padrão",
              minLives: 1,
              maxLives: null,
              lifeRangeId: null,
            },
          ];

    return sourceRanges.map((range) => {
      const referenceLives = range.maxLives ?? range.minLives;
      const fallback = getFallbackValues(referenceLives);

      return {
        range: range.label,
        key: range.key,
        ltcat: getServicePrice(
          packagePriceMap,
          matchedServices.ltcat?.id,
          range.lifeRangeId,
          matchedServices.ltcat?.reference_value ?? 0,
          fallback.ltcat
        ),
        pgr: getServicePrice(
          packagePriceMap,
          matchedServices.pgr?.id,
          range.lifeRangeId,
          matchedServices.pgr?.reference_value ?? 0,
          fallback.pgr
        ),
        drps: getServicePrice(
          packagePriceMap,
          matchedServices.drps?.id,
          range.lifeRangeId,
          matchedServices.drps?.reference_value ?? 0,
          fallback.drps
        ),
        pcmso: getServicePrice(
          packagePriceMap,
          matchedServices.pcmso?.id,
          range.lifeRangeId,
          matchedServices.pcmso?.reference_value ?? 0,
          fallback.pcmso
        ),
        vida: getServicePrice(
          packagePriceMap,
          matchedServices.vida?.id,
          range.lifeRangeId,
          matchedServices.vida?.reference_value ?? 0,
          fallback.vida
        ),
      };
    });
  }, [activeRanges, matchedServices, packagePriceMap]);

  const planCalc = useMemo(() => {
    const totalLaudos =
      currentTierValues.ltcat + currentTierValues.pgr + currentTierValues.drps + currentTierValues.pcmso;

    if (!selectedPlan) {
      return {
        monthly: 0,
        annual: 0,
        laudos: totalLaudos,
        vidasAnual: 0,
        valorUnitario: 0,
        descricaoUnitario: "Sem plano disponível",
      };
    }

    switch (selectedPlan.billing_model) {
      case "AVULSO": {
        const valorUnitario = currentTierValues.aso + currentTierValues.mensageria;
        const annualLives = lives * valorUnitario * 12;
        const totalAnnual = annualLives + totalLaudos;
        return {
          monthly: totalAnnual / 12,
          annual: totalAnnual,
          laudos: totalLaudos,
          vidasAnual: annualLives,
          valorUnitario,
          descricaoUnitario: `ASO ${formatCurrency(currentTierValues.aso)} + Mensageria ${formatCurrency(
            currentTierValues.mensageria
          )}`,
        };
      }
      case "POR_ASO": {
        const valorUnitario = currentTierValues.aso;
        const annualLives = lives * valorUnitario * 12;
        const totalAnnual = annualLives + totalLaudos;
        return {
          monthly: totalAnnual / 12,
          annual: totalAnnual,
          laudos: totalLaudos,
          vidasAnual: annualLives,
          valorUnitario,
          descricaoUnitario: `ASO Avulso ${formatCurrency(valorUnitario)}`,
        };
      }
      case "PACOTE_VIDAS":
      default: {
        const valorUnitario = currentTierValues.vida;
        const annualLives = lives * valorUnitario * 12;
        const totalAnnual = annualLives + totalLaudos;
        return {
          monthly: totalAnnual / 12,
          annual: totalAnnual,
          laudos: totalLaudos,
          vidasAnual: annualLives,
          valorUnitario,
          descricaoUnitario: `Pacote Vida (faixa ${getTier?.label ?? "Padrão"})`,
        };
      }
    }
  }, [currentTierValues, getTier, lives, selectedPlan]);

  const isLoading =
    plansLoading ||
    rangesLoading ||
    servicesLoading ||
    selectedPlanPricesLoading ||
    packagePlanPricesLoading;

  if (isLoading) {
    return <PlansTabLoading />;
  }

  if (!selectedPlan || activePlans.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Calculadora de Planos
            </CardTitle>
            <CardDescription>Informe a quantidade de vidas para simular os valores</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nenhum plano ativo cadastrado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora de Planos
          </CardTitle>
          <CardDescription>Informe a quantidade de vidas para simular os valores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="lives">Quantidade de Vidas</Label>
              <Input
                id="lives"
                type="number"
                min={1}
                value={lives}
                onChange={(e) => setLives(parseInt(e.target.value, 10) || 1)}
                className="w-32"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-sm">
                Faixa: {getTier?.label ?? "Padrão"}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                Valor Unitário: {formatCurrency(planCalc.valorUnitario)}
              </Badge>
              <Badge variant="default" className="text-sm bg-primary/80">
                {planCalc.descricaoUnitario}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {activePlans.map((plan, index) => {
          const meta = PLAN_META[plan.code] ?? PLAN_META.B;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative cursor-pointer transition-all duration-300 animate-fade-in",
                selectedPlan.code === plan.code
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:shadow-md hover:border-primary/30",
                plan.is_recommended && "border-success/50"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => setSelectedPlanCode(plan.code)}
            >
              {plan.is_recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-success text-success-foreground">Recomendado</Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className={cn("h-5 w-5", meta.colorClass)} />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {meta.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="animate-fade-in" style={{ animationDelay: "300ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Tabela de Valores - {packagePlan?.name ?? "Plano B (Pacote Vidas)"}
          </CardTitle>
          <CardDescription>Valores por faixa de quantidade de vidas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-semibold">Vidas</th>
                  <th className="pb-3 text-right font-semibold">LTCAT</th>
                  <th className="pb-3 text-right font-semibold">PGR</th>
                  <th className="pb-3 text-right font-semibold">DRPS</th>
                  <th className="pb-3 text-right font-semibold">PCMSO</th>
                  <th className="pb-3 text-right font-semibold">R$/Vida</th>
                </tr>
              </thead>
              <tbody>
                {planTiers.map((tier) => (
                  <tr
                    key={tier.key}
                    className={cn(
                      "border-b last:border-0",
                      tier.range === (getTier?.label ?? "Padrão") && "bg-primary/5 font-medium"
                    )}
                  >
                    <td className="py-3">{tier.range}</td>
                    <td className="py-3 text-right">{formatCurrency(tier.ltcat)}</td>
                    <td className="py-3 text-right">{formatCurrency(tier.pgr)}</td>
                    <td className="py-3 text-right">{formatCurrency(tier.drps)}</td>
                    <td className="py-3 text-right">{formatCurrency(tier.pcmso)}</td>
                    <td className="py-3 text-right">{formatCurrency(tier.vida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="prever-gradient-light border-primary/20 animate-fade-in" style={{ animationDelay: "400ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            Simulação para {lives} vidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Valor Mensal</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(planCalc.monthly)}</p>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Valor Anual</p>
              <p className="text-2xl font-bold">{formatCurrency(planCalc.annual)}</p>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Laudos (Anual)</p>
              <p className="text-2xl font-bold">{formatCurrency(planCalc.laudos)}</p>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Gestão Vidas</p>
              <p className="text-2xl font-bold">{formatCurrency(planCalc.vidasAnual)}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="lg">Gerar Proposta</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
