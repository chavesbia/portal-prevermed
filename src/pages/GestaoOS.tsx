import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useOrdens } from '@/hooks/useOrdens';
import { OSDashboardView } from '@/components/os/OSDashboardView';
import { OSListView } from '@/components/os/OSListView';
import { OSNovaView } from '@/components/os/OSNovaView';
import { OSGestaoVencimentosView } from '@/components/os/OSGestaoVencimentosView';
import { OSAgendaView } from '@/components/os/OSAgendaView';
import { OSEquipamentosView } from '@/components/os/OSEquipamentosView';
import { OSHistoricoGeralView } from '@/components/os/OSHistoricoGeralView';
import { OSProfissionaisView } from '@/components/os/OSProfissionaisView';
import { OSFinanceiroView } from '@/components/os/OSFinanceiroView';
import { OSAlertasView } from '@/components/os/OSAlertasView';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { OSAcrescimoFuncaoView } from '@/components/os/OSAcrescimoFuncaoView';
import { OSPPPView } from '@/components/os/OSPPPView';
import { useUserDepartments } from '@/hooks/useUserDepartments';

export default function GestaoOS() {
  const [searchParams] = useSearchParams();
  const { getModulePermissions, hasPermission } = useModulePermissions();
  const permissions = getModulePermissions('/gestao-os');
  const canCreateOS = hasPermission('/gestao-os/nova', 'edit');
  const { isFinanceiro } = useUserDepartments();
  const {
    isLoading, isInitialLoading, isLoadingAll, filters, setFilters,
    getFilteredOrdens, allOrdens, addOrdem, updateOrdem, updateOrdemStatus,
    deleteOrdem, getHistorico, getResponsaveis, fetchOrdens,
    currentPage, setCurrentPage, totalPages, totalCount
  } = useOrdens();

  const [novaOpen, setNovaOpen] = useState(false);
  const filteredOrdens = getFilteredOrdens();
  const responsaveis = getResponsaveis();
  const canEdit = permissions?.can_edit ?? false;

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de O.S</h1>
          <p className="text-muted-foreground">Controle de Ordens de Serviço</p>
        </div>
        {canCreateOS && (
          <Button onClick={() => setNovaOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova OS
          </Button>
        )}
      </div>

      <Tabs defaultValue={searchParams.get('os') ? 'ordens' : (searchParams.get('tab') || 'dashboard')}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="ordens">Ordens de Serviço</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="vencimentos">Vencimentos</TabsTrigger>
          <TabsTrigger value="acrescimos">Acréscimo de Função</TabsTrigger>
          <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
          {isFinanceiro && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <OSDashboardView
            ordens={allOrdens}
            filters={filters}
            setFilters={setFilters}
            responsaveis={responsaveis}
          />
        </TabsContent>

        <TabsContent value="alertas" className="mt-6">
          <OSAlertasView />
        </TabsContent>

        <TabsContent value="ordens" className="mt-6">
          <OSListView
            ordens={filteredOrdens}
            filters={filters}
            setFilters={setFilters}
            responsaveis={responsaveis}
            onUpdateStatus={updateOrdemStatus}
            onUpdateOrdem={updateOrdem}
            onDelete={deleteOrdem}
            onGetHistorico={getHistorico}
            onRefresh={fetchOrdens}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalCount={totalCount}
          />
        </TabsContent>

        <TabsContent value="agenda" className="mt-6">
          <OSAgendaView ordens={allOrdens} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="equipamentos" className="mt-6">
          <OSEquipamentosView ordens={allOrdens} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <OSHistoricoGeralView ordens={allOrdens} />
        </TabsContent>

        <TabsContent value="vencimentos" className="mt-6">
          <OSGestaoVencimentosView />
        </TabsContent>

        <TabsContent value="acrescimos" className="mt-6">
          <OSAcrescimoFuncaoView canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="profissionais" className="mt-6">
          <OSProfissionaisView canEdit={canEdit} />
        </TabsContent>

        {isFinanceiro && (
          <TabsContent value="financeiro" className="mt-6">
            <OSFinanceiroView />
          </TabsContent>
        )}
      </Tabs>

      {canCreateOS && (
        <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
          <DialogContent 
            className="max-w-4xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Nova Ordem de Serviço</DialogTitle>
              <DialogDescription>Cadastre uma nova OS no sistema.</DialogDescription>
            </DialogHeader>
            <OSNovaView
              embedded
              onSubmit={addOrdem}
              responsaveis={responsaveis}
              onDone={() => setNovaOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
