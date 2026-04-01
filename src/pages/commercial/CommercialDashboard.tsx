import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommercialClients } from '@/hooks/useCommercialClients';
import { computeClientStatus, statusLabels, type ClientStatus } from '@/lib/commercial-status';
import { FileX, AlertTriangle, Clock, FileWarning, FileCheck, Loader2, ClipboardList } from 'lucide-react';

interface Props {
  onNavigate: (status: ClientStatus) => void;
}

const dashboardCards: { status: ClientStatus; icon: React.ElementType; color: string }[] = [
  { status: 'sem_contrato', icon: FileX, color: 'text-destructive' },
  { status: 'vencido', icon: AlertTriangle, color: 'text-destructive' },
  { status: 'a_vencer', icon: Clock, color: 'text-yellow-600' },
  { status: 'contrato_nao_assinado', icon: FileWarning, color: 'text-orange-500' },
  { status: 'documentacao_incompleta', icon: FileCheck, color: 'text-amber-600' },
  { status: 'renovacao_pendente', icon: FileWarning, color: 'text-blue-500' },
];

export default function CommercialDashboard({ onNavigate }: Props) {
  const { clients, isLoading } = useCommercialClients();

  const counts = useMemo(() => {
    const result: Record<ClientStatus, number> = {
      sem_contrato: 0,
      contrato_nao_assinado: 0,
      vencido: 0,
      a_vencer: 0,
      renovacao_pendente: 0,
      documentacao_incompleta: 0,
      ok: 0,
    };
    for (const c of clients.filter(c => c.is_active)) {
      const status = computeClientStatus({ ...c, attachments_count: 0 });
      result[status]++;
    }
    return result;
  }, [clients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCount = clients.filter(c => c.is_active).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Clientes Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">Clientes OK</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-700">{counts.ok}</p>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-lg font-semibold">Atenções</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboardCards.map(({ status, icon: Icon, color }) => (
          <Card
            key={status}
            className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
            style={{ borderLeftColor: color.includes('destructive') ? 'hsl(var(--destructive))' : undefined }}
            onClick={() => onNavigate(status)}
          >
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {statusLabels[status]}
              </CardTitle>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{counts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
