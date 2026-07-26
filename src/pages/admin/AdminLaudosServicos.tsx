import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaudosServicosManager } from "@/components/admin/LaudosServicosManager";
import { ProfissionaisManager } from "@/components/admin/ProfissionaisManager";

export default function AdminLaudosServicos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laudos e Serviços</h1>
        <p className="text-muted-foreground">
          Catálogo central reutilizado em Renovação, Proposta, Contrato, OS e Faturamento.
        </p>
      </div>
      <Tabs defaultValue="catalogo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogo">
          <LaudosServicosManager />
        </TabsContent>
        <TabsContent value="profissionais">
          <ProfissionaisManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
