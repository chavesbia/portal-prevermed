import { Package, Users, FileText, Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PLAN_TIERS = [
  { range: "1 A 5", ltcat: 650, pgr: 550, drps: 600, pcmso: 300, vida: 18 },
  { range: "6 A 10", ltcat: 780, pgr: 660, drps: 750, pcmso: 360, vida: 16 },
  { range: "11 A 20", ltcat: 910, pgr: 770, drps: 900, pcmso: 420, vida: 14 },
  { range: "21 A 30", ltcat: 1040, pgr: 880, drps: 1350, pcmso: 480, vida: 12.5 },
  { range: "31 A 50", ltcat: 1300, pgr: 1100, drps: 1500, pcmso: 600, vida: 10.5 },
  { range: "PADRÃO", ltcat: 1500, pgr: 1200, drps: 1700, pcmso: 690, vida: 15 },
];

const PLANS = [
  {
    id: "A",
    name: "Plano A - Padrão",
    description: "Cobrança completa com laudos individuais",
    color: "primary",
    features: ["ASO + Mensageria (eSocial)", "Laudos separados", "Sem desconto por volume"],
  },
  {
    id: "B",
    name: "Plano B - Pacote Vidas",
    description: "Pacote com desconto progressivo por vidas",
    color: "success",
    highlight: true,
    features: ["Desconto por volume", "Laudos inclusos no pacote", "Ideal para empresas médias"],
  },
  {
    id: "C",
    name: "Plano C - Cobrança ASO",
    description: "Cobrança por ASO realizado",
    color: "info",
    features: ["Pagamento por uso", "Flexibilidade total", "Ideal para turnover alto"],
  },
];

export function PlansTab() {
  const [lives, setLives] = useState(10);
  const [selectedPlan, setSelectedPlan] = useState<string>("B");

  const getTier = (numLives: number) => {
    if (numLives <= 5) return PLAN_TIERS[0];
    if (numLives <= 10) return PLAN_TIERS[1];
    if (numLives <= 20) return PLAN_TIERS[2];
    if (numLives <= 30) return PLAN_TIERS[3];
    if (numLives <= 50) return PLAN_TIERS[4];
    return PLAN_TIERS[5];
  };

  const tier = getTier(lives);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Plano A - Cobrança individual sem desconto
  const calculatePlanA = () => {
    const asoValue = 45; // Valor fixo por ASO
    const mensageriaValue = 8; // Valor por mensageria eSocial
    const valorUnitario = asoValue + mensageriaValue;
    const annualASO = lives * valorUnitario * 12;
    const totalLaudos = tier.ltcat + tier.pgr + tier.drps + tier.pcmso;
    const totalAnnual = annualASO + totalLaudos;
    return {
      monthly: totalAnnual / 12,
      annual: totalAnnual,
      laudos: totalLaudos,
      vidasAnual: annualASO,
      valorUnitario,
      descricaoUnitario: `ASO R$${asoValue} + Mensageria R$${mensageriaValue}`,
    };
  };

  // Plano B - Pacote com desconto progressivo por vidas
  const calculatePlanB = () => {
    const valorUnitario = tier.vida;
    const annualLives = lives * valorUnitario * 12;
    const totalLaudos = tier.ltcat + tier.pgr + tier.drps + tier.pcmso;
    const totalAnnual = annualLives + totalLaudos;
    return {
      monthly: totalAnnual / 12,
      annual: totalAnnual,
      laudos: totalLaudos,
      vidasAnual: annualLives,
      valorUnitario,
      descricaoUnitario: `Pacote Vida (faixa ${tier.range})`,
    };
  };

  // Plano C - Cobrança por ASO realizado
  const calculatePlanC = () => {
    const asoValue = 55; // Valor por ASO avulso
    const valorUnitario = asoValue;
    const annualASO = lives * valorUnitario * 12;
    const totalLaudos = tier.ltcat + tier.pgr + tier.drps + tier.pcmso;
    const totalAnnual = annualASO + totalLaudos;
    return {
      monthly: totalAnnual / 12,
      annual: totalAnnual,
      laudos: totalLaudos,
      vidasAnual: annualASO,
      valorUnitario,
      descricaoUnitario: `ASO Avulso R$${asoValue}`,
    };
  };

  const getSelectedPlanCalc = () => {
    switch (selectedPlan) {
      case "A":
        return calculatePlanA();
      case "B":
        return calculatePlanB();
      case "C":
        return calculatePlanC();
      default:
        return calculatePlanB();
    }
  };

  const planCalc = getSelectedPlanCalc();

  return (
    <div className="space-y-6">
      {/* Calculadora de Vidas */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora de Planos
          </CardTitle>
          <CardDescription>
            Informe a quantidade de vidas para simular os valores
          </CardDescription>
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
                onChange={(e) => setLives(parseInt(e.target.value) || 1)}
                className="w-32"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-sm">
                Faixa: {tier.range}
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

      {/* Cards dos Planos */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan, index) => (
          <Card
            key={plan.id}
            className={cn(
              "relative cursor-pointer transition-all duration-300 animate-fade-in",
              selectedPlan === plan.id
                ? "ring-2 ring-primary shadow-lg"
                : "hover:shadow-md hover:border-primary/30",
              plan.highlight && "border-success/50"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
            onClick={() => setSelectedPlan(plan.id)}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-success text-success-foreground">Recomendado</Badge>
              </div>
            )}
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className={cn("h-5 w-5", `text-${plan.color}`)} />
                <CardTitle className="text-lg">{plan.name}</CardTitle>
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de Valores Plano B */}
      <Card className="animate-fade-in" style={{ animationDelay: "300ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Tabela de Valores - Plano B (Pacote Vidas)
          </CardTitle>
          <CardDescription>
            Valores por faixa de quantidade de vidas
          </CardDescription>
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
                {PLAN_TIERS.map((t, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "border-b last:border-0",
                      t.range === tier.range && "bg-primary/5 font-medium"
                    )}
                  >
                    <td className="py-3">{t.range}</td>
                    <td className="py-3 text-right">{formatCurrency(t.ltcat)}</td>
                    <td className="py-3 text-right">{formatCurrency(t.pgr)}</td>
                    <td className="py-3 text-right">{formatCurrency(t.drps)}</td>
                    <td className="py-3 text-right">{formatCurrency(t.pcmso)}</td>
                    <td className="py-3 text-right">{formatCurrency(t.vida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resumo da Simulação */}
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
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(planCalc.monthly)}
              </p>
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
            <Button size="lg">
              Gerar Proposta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
