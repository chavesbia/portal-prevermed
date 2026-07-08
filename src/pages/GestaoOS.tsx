import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrdens } from '@/hooks/useOrdens';
import { OSDashboardView } from '@/components/os/OSDashboardView';
import { OSListView } from '@/components/os/OSListView';
import { OSNovaView } from '@/components/os/OSNovaView';
import { OSSLAView } from '@/components/os/OSSLAView';
import { OSGestaoVencimentosView } from '@/components/os/OSGestaoVencimentosView';
import { OSAgendaView } from '@/components/os/OSAgendaView';
import { OSEquipamentosView } from '@/components/os/OSEquipamentosView';
import { OSHistoricoGeralView } from '@/components/os/OSHistoricoGeralView';
import { OSProfissionaisView } from '@/components/os/OSProfissionaisView';
import { OSFinanceiroView } from '@/components/os/OSFinanceiroView';
import { OSAlertasView } from '@/components/os/OSAlertasView';
import { OSDashboardExecutivoView } from '@/components/os/OSDashboardExecutivoView';
import { useModulePermissions } from '@/hooks/useModulePermissions';

export default function GestaoOS() {
  const { getModulePermissions } = useModulePermissions();
  const permissions = getModulePermissions('/gestao-os');
  const {
    isLoading, filters, setFilters,
    getFilteredOrdens, addOrdem, updateOrdem, updateOrdemStatus,
    deleteOrdem, getHistorico, getResponsaveis, fetchOrdens,
  } = useOrdens();

  const filteredOrdens = getFilteredOrdens();
  const responsaveis = getResponsaveis();
  const canEdit = permissions?.can_edit ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de O.S</h1>
        <p className="text-muted-foreground">Controle de Ordens de Serviço — Engenharia</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="ordens">Ordens de Serviço</TabsTrigger>
          {canEdit && <TabsTrigger value="nova">Nova OS</TabsTrigger>}
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="vencimentos">Vencimentos</TabsTrigger>
          <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <OSDashboardView
            ordens={filteredOrdens}
            filters={filters}
            setFilters={setFilters}
            responsaveis={responsaveis}
          />
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
          />
        </TabsContent>

        {canEdit && (
          <TabsContent value="nova" className="mt-6">
            <OSNovaView
              onSubmit={addOrdem}
              responsaveis={responsaveis}
            />
          </TabsContent>
        )}

        <TabsContent value="agenda" className="mt-6">
          <OSAgendaView ordens={filteredOrdens} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="equipamentos" className="mt-6">
          <OSEquipamentosView ordens={filteredOrdens} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <OSHistoricoGeralView ordens={filteredOrdens} />
        </TabsContent>

        <TabsContent value="sla" className="mt-6">
          <OSSLAView ordens={filteredOrdens} />
        </TabsContent>

        <TabsContent value="vencimentos" className="mt-6">
          <OSGestaoVencimentosView />
        </TabsContent>

        <TabsContent value="profissionais" className="mt-6">
          <OSProfissionaisView canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-6">
          <OSFinanceiroView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
