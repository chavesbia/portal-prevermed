import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCommercialClients } from '@/hooks/useCommercialClients';
import { computeClientStatus, statusLabels, statusColors, type ClientStatus } from '@/lib/commercial-status';
import { FileX, AlertTriangle, Clock, FileWarning, FileCheck, Loader2, ClipboardList, Users } from 'lucide-react';

interface Props {
  onNavigate: (status: ClientStatus) => void;
  onSubgroupNavigate: (subgroup: string) => void;
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

  const activeClients = useMemo(() => clients.filter(c => c.is_active), [clients]);

  const counts = useMemo(() => {
    const result: Record<ClientStatus, number> = {
      sem_contrato: 0, contrato_nao_assinado: 0, vencido: 0,
      a_vencer: 0, renovacao_pendente: 0, documentacao_incompleta: 0, ok: 0,
    };
    for (const c of activeClients) {
      const status = computeClientStatus({ ...c, attachments_count: 0 });
      result[status]++;
    }
    return result;
  }, [activeClients]);

  const subgroupData = useMemo(() => {
    const map: Record<string, { total: number; statuses: Record<ClientStatus, number> }> = {};
    for (const c of activeClients) {
      const sg = c.subgroup || 'Sem subgrupo';
      if (!map[sg]) {
        map[sg] = { total: 0, statuses: { sem_contrato: 0, contrato_nao_assinado: 0, vencido: 0, a_vencer: 0, renovacao_pendente: 0, documentacao_incompleta: 0, ok: 0 } };
      }
      map[sg].total++;
      const status = computeClientStatus({ ...c, attachments_count: 0 });
      map[sg].statuses[status]++;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [activeClients]);

  const pendingReviewCount = useMemo(() => activeClients.filter(c => !c.revisado).length, [activeClients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Clientes Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeClients.length}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Documentação em Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{counts.ok}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Pendentes de Revisão</CardTitle>
            <ClipboardList className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{pendingReviewCount}</p>
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

      <h3 className="text-lg font-semibold">Subgrupos</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subgroupData.map(([name, data]) => {
          const problemCount = data.total - data.statuses.ok;
          return (
            <Card key={name}>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">{name}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold">{data.total} <span className="text-sm font-normal text-muted-foreground">clientes</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {data.statuses.ok > 0 && (
                    <Badge className="bg-emerald-600 text-white text-[10px]">{data.statuses.ok} em dia</Badge>
                  )}
                  {data.statuses.vencido > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{data.statuses.vencido} vencido(s)</Badge>
                  )}
                  {data.statuses.a_vencer > 0 && (
                    <Badge className="bg-yellow-500 text-white text-[10px]">{data.statuses.a_vencer} a vencer</Badge>
                  )}
                  {data.statuses.sem_contrato > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{data.statuses.sem_contrato} s/ contrato</Badge>
                  )}
                  {data.statuses.documentacao_incompleta > 0 && (
                    <Badge className="bg-amber-600 text-white text-[10px]">{data.statuses.documentacao_incompleta} doc. incompleta</Badge>
                  )}
                  {data.statuses.contrato_nao_assinado > 0 && (
                    <Badge className="bg-orange-500 text-white text-[10px]">{data.statuses.contrato_nao_assinado} não assinado</Badge>
                  )}
                  {data.statuses.renovacao_pendente > 0 && (
                    <Badge className="bg-blue-500 text-white text-[10px]">{data.statuses.renovacao_pendente} renovação</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}