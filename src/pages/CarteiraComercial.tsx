import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, List, Plus, FileUp } from 'lucide-react';
import { ProtectedModuleRoute } from '@/components/layout/ProtectedModuleRoute';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useSearchParams } from 'react-router-dom';
import CommercialDashboard from './commercial/CommercialDashboard';
import CommercialList from './commercial/CommercialList';
import CommercialClientForm from './commercial/CommercialClientForm';
import CommercialClientDetail from './commercial/CommercialClientDetail';
import CommercialImport from './commercial/CommercialImport';
import type { ClientStatus } from '@/lib/commercial-status';

const MODULE_ROUTE = '/carteira-comercial';

export default function CarteiraComercial() {
  const { hasPermission, isReadOnly } = useModulePermissions();
  const canCreate = hasPermission(MODULE_ROUTE, 'create');
  const canEdit = hasPermission(MODULE_ROUTE, 'edit');
  const readOnly = isReadOnly(MODULE_ROUTE);
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'dashboard';

  const [statusFilter, setStatusFilter] = useState<ClientStatus | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const handleDashboardNavigate = useCallback((status: ClientStatus) => {
    setStatusFilter(status);
    setSearchParams({ tab: 'clientes' }, { replace: true });
  }, [setSearchParams]);

  const handleViewClient = useCallback((id: string) => {
    setSelectedClientId(id);
    setSearchParams({ tab: 'detalhe' }, { replace: true });
  }, [setSearchParams]);

  const handleBackToList = useCallback(() => {
    setSelectedClientId(null);
    setSearchParams({ tab: 'clientes' }, { replace: true });
  }, [setSearchParams]);

  return (
    <ProtectedModuleRoute route={MODULE_ROUTE}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Carteira Comercial</h1>
            <p className="text-muted-foreground text-sm">Controle contratual da carteira de clientes</p>
          </div>
        </div>

        <Tabs value={defaultTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5">
              <List className="h-4 w-4" /> Clientes
            </TabsTrigger>
            {canCreate && (
              <TabsTrigger value="novo" className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo Cliente
              </TabsTrigger>
            )}
            {canEdit && (
              <TabsTrigger value="importar" className="gap-1.5">
                <FileUp className="h-4 w-4" /> Importar SOC
              </TabsTrigger>
            )}
            {selectedClientId && (
              <TabsTrigger value="detalhe" className="gap-1.5">
                Detalhes
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard">
            <CommercialDashboard onNavigate={handleDashboardNavigate} />
          </TabsContent>

          <TabsContent value="clientes">
            <CommercialList
              initialStatusFilter={statusFilter}
              onClearStatusFilter={() => setStatusFilter(null)}
              onViewClient={handleViewClient}
              readOnly={readOnly}
            />
          </TabsContent>

          <TabsContent value="novo">
            {canCreate && (
              <CommercialClientForm
                onSuccess={() => setSearchParams({ tab: 'clientes' }, { replace: true })}
              />
            )}
          </TabsContent>

          <TabsContent value="importar">
            {canEdit && (
              <CommercialImport onBack={() => setSearchParams({ tab: 'clientes' }, { replace: true })} />
            )}
          </TabsContent>

          <TabsContent value="detalhe">
            {selectedClientId && (
              <CommercialClientDetail
                clientId={selectedClientId}
                onBack={handleBackToList}
                readOnly={readOnly}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedModuleRoute>
  );
}
