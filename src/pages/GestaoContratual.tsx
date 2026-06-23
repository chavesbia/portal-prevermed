import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, FileCode, ShieldCheck, Braces } from 'lucide-react';
import { ProtectedModuleRoute } from '@/components/layout/ProtectedModuleRoute';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useAuth } from '@/contexts/AuthContext';
import ContratualDashboard from './contratual/ContratualDashboard';
import ContratualClientes from './contratual/ContratualClientes';
import ContratualModelos from './contratual/ContratualModelos';
import ContratualContratos from './contratual/ContratualContratos';
import ContratualAuditoria from './contratual/ContratualAuditoria';
import ContratualPlaceholders from './contratual/ContratualPlaceholders';

const MODULE_ROUTE = '/gestao-contratual';

export default function GestaoContratual() {
  const { hasPermission } = useModulePermissions();
  const { isAdmMaster } = useAuth() as any;
  const canEditClientes = hasPermission(`${MODULE_ROUTE}/clientes`, 'edit') || hasPermission(MODULE_ROUTE, 'edit');
  const canEditModelos = hasPermission(`${MODULE_ROUTE}/modelos`, 'edit') || hasPermission(MODULE_ROUTE, 'edit');
  const canEditContratos = hasPermission(`${MODULE_ROUTE}/contratos`, 'edit') || hasPermission(MODULE_ROUTE, 'edit');

  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'dashboard';

  return (
    <ProtectedModuleRoute route={MODULE_ROUTE}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Gestão Contratual</h1>
          <p className="text-muted-foreground text-sm">
            Geração, assinatura e controle de vigência dos contratos comerciais.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setSp({ tab: v }, { replace: true })}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="contratos" className="gap-1.5">
              <FileText className="h-4 w-4" /> Contratos
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5">
              <Users className="h-4 w-4" /> Clientes
            </TabsTrigger>
            <TabsTrigger value="modelos" className="gap-1.5">
              <FileCode className="h-4 w-4" /> Modelos
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Auditoria
            </TabsTrigger>
            {isAdmMaster && (
              <TabsTrigger value="placeholders" className="gap-1.5">
                <Braces className="h-4 w-4" /> Placeholders
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <ContratualDashboard />
          </TabsContent>
          <TabsContent value="contratos" className="mt-4">
            <ContratualContratos canEdit={canEditContratos} />
          </TabsContent>
          <TabsContent value="clientes" className="mt-4">
            <ContratualClientes canEdit={canEditClientes} />
          </TabsContent>
          <TabsContent value="modelos" className="mt-4">
            <ContratualModelos canEdit={canEditModelos} />
          </TabsContent>
          <TabsContent value="auditoria" className="mt-4">
            <ContratualAuditoria />
          </TabsContent>
          {isAdmMaster && (
            <TabsContent value="placeholders" className="mt-4">
              <ContratualPlaceholders />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </ProtectedModuleRoute>
  );
}
