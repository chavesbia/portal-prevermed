import { useState } from "react";
import { Calculator, History, Package, GraduationCap, RefreshCw, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { InLocoTab } from "@/components/pricing/InLocoTab";
import { PlansTab } from "@/components/pricing/PlansTab";
import { TrainingsTab } from "@/components/pricing/TrainingsTab";
import { QuotationHistory } from "@/components/history/QuotationHistory";
import { RenewalForm } from "@/components/pricing/RenewalForm";
import { RenewalHistory } from "@/components/pricing/RenewalHistory";
import { InLocoSettingsSheet } from "@/components/pricing/InLocoSettingsSheet";
import { RenewalSettingsSheet } from "@/components/pricing/RenewalSettingsSheet";
import { PlansSettingsSheet } from "@/components/pricing/PlansSettingsSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useServices } from "@/hooks/useServices";
import { mapToPricingRole } from "@/lib/pricing-roles";
import { CustosAdicionaisData, initialCustosAdicionais } from "@/components/pricing/CustosAdicionaisTab";
import { EditingQuotation } from "@/types/quotation-editing";
import { Loader2 } from "lucide-react";

export default function Precificacao() {
  const [activeTab, setActiveTab] = useState("inloco");
  const [inlocoSubTab, setInlocoSubTab] = useState("nova");
  const [renovacaoSubTab, setRenovacaoSubTab] = useState("nova");
  const { isAdmMaster, profile, role } = useAuth();
  const { services, isLoading } = useServices();

  const [custosAdicionais, setCustosAdicionais] = useState<CustosAdicionaisData>(initialCustosAdicionais);
  const [editingQuotation, setEditingQuotation] = useState<EditingQuotation | null>(null);

  const [inlocoSettingsOpen, setInlocoSettingsOpen] = useState(false);
  const [renewalSettingsOpen, setRenewalSettingsOpen] = useState(false);
  const [plansSettingsOpen, setPlansSettingsOpen] = useState(false);

  const userRole = mapToPricingRole(
    profile?.hierarchy_position as any,
    role as any
  );

  const handleEditQuotation = (q: EditingQuotation) => {
    setEditingQuotation(q);
    setCustosAdicionais(q.custosAdicionais);
    setActiveTab("inloco");
    setInlocoSubTab("nova");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Precificação</h1>
        <p className="text-muted-foreground">
          Monte orçamentos, consulte planos e treinamentos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="inloco" className="gap-1.5">
            <Calculator className="h-4 w-4" />
            In Loco
          </TabsTrigger>
          <TabsTrigger value="renovacao" className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Renovação
          </TabsTrigger>
          <TabsTrigger value="planos" className="gap-1.5">
            <Package className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="treinamentos" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Treinamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inloco" className="mt-6">
          <Tabs value={inlocoSubTab} onValueChange={setInlocoSubTab}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TabsList>
                <TabsTrigger value="nova" className="gap-1.5">
                  <Calculator className="h-4 w-4" />
                  Nova Memória
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-1.5">
                  <History className="h-4 w-4" />
                  Histórico
                </TabsTrigger>
              </TabsList>
              {isAdmMaster && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setInlocoSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </Button>
              )}
            </div>
            <TabsContent value="nova" className="mt-4">
              <InLocoTab
                services={services}
                userRole={userRole}
                custosAdicionais={custosAdicionais}
                onCustosChange={setCustosAdicionais}
                editingQuotation={editingQuotation}
                onClearEdit={() => setEditingQuotation(null)}
              />
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
              <QuotationHistory onEditQuotation={handleEditQuotation} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="renovacao" className="mt-6">
          <Tabs value={renovacaoSubTab} onValueChange={setRenovacaoSubTab}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TabsList>
                <TabsTrigger value="nova" className="gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  Nova Renovação
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-1.5">
                  <History className="h-4 w-4" />
                  Histórico
                </TabsTrigger>
              </TabsList>
              {isAdmMaster && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setRenewalSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                  Configuração
                </Button>
              )}
            </div>
            <TabsContent value="nova" className="mt-4">
              <RenewalForm onSaved={() => setRenovacaoSubTab("historico")} />
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
              <RenewalHistory />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="planos" className="mt-6 space-y-4">
          {isAdmMaster && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setPlansSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
                Configuração
              </Button>
            </div>
          )}
          <PlansTab />
        </TabsContent>
        <TabsContent value="treinamentos" className="mt-6">
          <TrainingsTab />
        </TabsContent>
      </Tabs>

      <InLocoSettingsSheet open={inlocoSettingsOpen} onOpenChange={setInlocoSettingsOpen} />
      <RenewalSettingsSheet open={renewalSettingsOpen} onOpenChange={setRenewalSettingsOpen} />
      <PlansSettingsSheet open={plansSettingsOpen} onOpenChange={setPlansSettingsOpen} />
    </div>
  );
}
