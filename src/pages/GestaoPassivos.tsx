import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, List } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ProtectedModuleRoute } from '@/components/layout/ProtectedModuleRoute';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useAuth } from '@/contexts/AuthContext';
import PassivosDashboard from './passivos/PassivosDashboard';
import PassivosList from './passivos/PassivosList';

const MODULE_ROUTE = '/gestao-passivos';

export default function GestaoPassivos() {
  const { hasPermission } = useModulePermissions();
  const { isAdmMaster } = useAuth();
  const canEdit = isAdmMaster || hasPermission(MODULE_ROUTE, 'edit') || hasPermission(MODULE_ROUTE, 'create');
  const canDelete = isAdmMaster;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';

  return (
    <ProtectedModuleRoute route={MODULE_ROUTE}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Passivos</h1>
          <p className="text-muted-foreground text-sm">Controle de parcelamentos tributários por CNPJ</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="parcelamentos" className="gap-1.5"><List className="h-4 w-4" /> Parcelamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><PassivosDashboard /></TabsContent>
          <TabsContent value="parcelamentos"><PassivosList canEdit={canEdit} canDelete={canDelete} /></TabsContent>
        </Tabs>
      </div>
    </ProtectedModuleRoute>
  );
}
