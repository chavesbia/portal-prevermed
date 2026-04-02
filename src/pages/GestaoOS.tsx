import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrdens } from '@/hooks/useOrdens';
import { OSDashboardView } from '@/components/os/OSDashboardView';
import { OSListView } from '@/components/os/OSListView';
import { OSNovaView } from '@/components/os/OSNovaView';
import { useModulePermissions } from '@/hooks/useModulePermissions';

export default function GestaoOS() {
  const { getModulePermissions } = useModulePermissions();
  const permissions = getModulePermissions('/gestao-os');
  const {
    isLoading, filters, setFilters,
    getFilteredOrdens, addOrdem, updateOrdemStatus,
    deleteOrdem, getHistorico, getResponsaveis,
  } = useOrdens();

  const filteredOrdens = getFilteredOrdens();
  const responsaveis = getResponsaveis();
  const canEdit = permissions?.can_edit ?? false;
  const canDelete = permissions?.can_delete ?? false;

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
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="ordens">Ordens de Serviço</TabsTrigger>
          {canEdit && <TabsTrigger value="nova">Nova OS</TabsTrigger>}
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
            onDelete={deleteOrdem}
            onGetHistorico={getHistorico}
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
      </Tabs>
    </div>
  );
}
