import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, List, LayoutDashboard } from "lucide-react";
import GuiasImportacao from "./guias/GuiasImportacao";
import GuiasList from "./guias/GuiasList";
import GuiasDashboard from "./guias/GuiasDashboard";
import { useAuth } from "@/contexts/AuthContext";

export default function GestaoGuias() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Guias</h1>
        <p className="text-muted-foreground">Controle operacional de guias do SOC</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="guias" className="gap-2">
            <List className="h-4 w-4" />
            Guias
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="importacao" className="gap-2">
              <Upload className="h-4 w-4" />
              Importação
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard">
          <GuiasDashboard />
        </TabsContent>

        <TabsContent value="guias">
          <GuiasList />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="importacao">
            <GuiasImportacao />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
