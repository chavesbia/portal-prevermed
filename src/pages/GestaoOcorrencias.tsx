import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, HeadphonesIcon, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type OccurrenceTicketRow = {
  id: string;
  ticket_number: string;
  company_name: string;
  ticket_type: string;
  priority: string;
  status: string;
  due_at: string | null;
  updated_at: string;
};

const statusLabels: Record<string, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  em_tratativa: 'Em tratativa',
  aguardando_retorno_interno: 'Aguardando retorno interno',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  aguardando_validacao_cliente: 'Aguardando validação do cliente',
  concluido: 'Concluído',
  reaberto: 'Reaberto',
};

const priorityLabels: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export default function GestaoOcorrencias() {
  const { hasPermission } = useModulePermissions();
  const [tickets, setTickets] = useState<OccurrenceTicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreate = hasPermission('/gestao-ocorrencias', 'create');
  const canManage = hasPermission('/gestao-ocorrencias/gestao', 'edit');

  const loadTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('occurrence_tickets')
      .select('id, ticket_number, company_name, ticket_type, priority, status, due_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Erro ao carregar ocorrências:', error);
      setTickets([]);
      setLoading(false);
      return;
    }

    setTickets((data || []) as OccurrenceTicketRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const summary = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((ticket) => ['aberto', 'em_analise', 'em_tratativa', 'reaberto'].includes(ticket.status)).length;
    const waiting = tickets.filter((ticket) => ['aguardando_retorno_interno', 'aguardando_cliente', 'aguardando_validacao_cliente'].includes(ticket.status)).length;
    const done = tickets.filter((ticket) => ['resolvido', 'concluido'].includes(ticket.status)).length;

    return { total, open, waiting, done };
  }, [tickets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Ocorrências</h1>
          <p className="text-muted-foreground">
            Central de ocorrências, solicitações, reclamações e feedbacks do Relacionamento.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadTickets} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          {canCreate && <Button>Novo chamado</Button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Chamados carregados</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{summary.total}</span>
            <HeadphonesIcon className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Em andamento</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{summary.open}</span>
            <Clock3 className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aguardando retorno</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{summary.waiting}</span>
            <AlertTriangle className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolvidos / concluídos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{summary.done}</span>
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg">Fila inicial do módulo</CardTitle>
            <p className="text-sm text-muted-foreground">
              O módulo já está visível no portal e preparado para receber a implementação completa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Visualização liberada</Badge>
            {canManage && <Badge>Gestão habilitada</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum chamado cadastrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chamado</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.ticket_number}</TableCell>
                    <TableCell>{ticket.company_name}</TableCell>
                    <TableCell>{ticket.ticket_type}</TableCell>
                    <TableCell>{priorityLabels[ticket.priority] ?? ticket.priority}</TableCell>
                    <TableCell>{statusLabels[ticket.status] ?? ticket.status}</TableCell>
                    <TableCell>
                      {ticket.due_at
                        ? new Date(ticket.due_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}