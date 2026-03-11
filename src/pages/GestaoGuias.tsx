import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, List, LayoutDashboard } from "lucide-react";
import GuiasImportacao from "./guias/GuiasImportacao";
import GuiasList from "./guias/GuiasList";
import GuiasDashboard from "./guias/GuiasDashboard";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { ProtectedModuleRoute } from "@/components/layout/ProtectedModuleRoute";

const MODULE_ROUTE = '/gestao-guias';

export default function GestaoGuias() {
  const { hasPermission, isReadOnly } = useModulePermissions();
  const canImport = hasPermission(MODULE_ROUTE, 'create');
  const readOnly = isReadOnly(MODULE_ROUTE);

  return (
    <ProtectedModuleRoute route={MODULE_ROUTE}>
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
            {canImport && (
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
            <GuiasList readOnly={readOnly} />
          </TabsContent>

          {canImport && (
            <TabsContent value="importacao">
              <GuiasImportacao />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </ProtectedModuleRoute>
  );
}
