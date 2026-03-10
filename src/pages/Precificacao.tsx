import { useState } from "react";
import { Calculator, History, Package, GraduationCap, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InLocoTab } from "@/components/pricing/InLocoTab";
import { PlansTab } from "@/components/pricing/PlansTab";
import { TrainingsTab } from "@/components/pricing/TrainingsTab";
import { QuotationHistory } from "@/components/history/QuotationHistory";
import { AdminTab } from "@/components/admin/AdminTab";
import { useAuth } from "@/contexts/AuthContext";

export default function Precificacao() {
  const [activeTab, setActiveTab] = useState("inloco");
  const { isAdmin } = useAuth();

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
          <TabsTrigger value="planos" className="gap-1.5">
            <Package className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="treinamentos" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Treinamentos
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="inloco" className="mt-6">
          <InLocoTab />
        </TabsContent>
        <TabsContent value="planos" className="mt-6">
          <PlansTab />
        </TabsContent>
        <TabsContent value="treinamentos" className="mt-6">
          <TrainingsTab />
        </TabsContent>
        <TabsContent value="historico" className="mt-6">
          <QuotationHistory />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="admin" className="mt-6">
            <AdminTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
