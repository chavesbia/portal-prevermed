import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, List, LayoutDashboard, Settings, Download, Loader2 } from "lucide-react";
import GuiasImportacao from "./guias/GuiasImportacao";
import GuiasList from "./guias/GuiasList";
import GuiasDashboard from "./guias/GuiasDashboard";
import PrestadoresBloqueadosConfig from "@/components/guias/PrestadoresBloqueadosConfig";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { ProtectedModuleRoute } from "@/components/layout/ProtectedModuleRoute";
import { useSearchParams } from "react-router-dom";
import { emptyFilters, type GuiaFiltersState } from "@/components/guias/GuiaFilters";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { exportGuiasCompleto } from "@/lib/guias/export";
import { toast } from "@/hooks/use-toast";

const MODULE_ROUTE = '/gestao-guias';

export default function GestaoGuias() {
  const { hasPermission, isReadOnly } = useModulePermissions();
  const { isAdmin } = useAuth();
  const canImport = hasPermission(MODULE_ROUTE, 'create');
  const readOnly = isReadOnly(MODULE_ROUTE);
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "dashboard";

  const [injectedFilters, setInjectedFilters] = useState<Partial<GuiaFiltersState> | null>(null);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const handleDashboardNavigate = useCallback((filterOverrides: Record<string, any>) => {
    setInjectedFilters({ ...emptyFilters, ...filterOverrides });
    setSearchParams({ tab: "guias" }, { replace: true });
  }, [setSearchParams]);

  return (
    <ProtectedModuleRoute route={MODULE_ROUTE}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Guias</h1>
          <p className="text-muted-foreground">Controle operacional de guias do SOC</p>
        </div>

        <Tabs value={defaultTab} onValueChange={handleTabChange} className="space-y-4">
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
            {isAdmin && (
              <TabsTrigger value="configuracoes" className="gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard">
            <GuiasDashboard onNavigateToList={handleDashboardNavigate} />
          </TabsContent>

          <TabsContent value="guias">
            <GuiasList readOnly={readOnly} injectedFilters={injectedFilters} onFiltersConsumed={() => setInjectedFilters(null)} />
          </TabsContent>

          {canImport && (
            <TabsContent value="importacao">
              <GuiasImportacao />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="configuracoes">
              <PrestadoresBloqueadosConfig />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </ProtectedModuleRoute>
  );
}
