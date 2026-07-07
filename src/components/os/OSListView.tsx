import React, { useState } from 'react';
import { Eye, Pencil, Trash2, History, MoreHorizontal, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OSFilterBar } from '@/components/os/OSFilterBar';
import { OSDetailDialog } from '@/components/os/OSDetailDialog';
import { OSHistoryDialog } from '@/components/os/OSHistoryDialog';
import { OSEditDialog } from '@/components/os/OSEditDialog';
import { OSFinalizarServicoDialog } from '@/components/os/OSFinalizarServicoDialog';
import { OrdemServico, ServicoOS, statusOSColors, statusServicoColors, StatusOS } from '@/types/os';
import { differenceInDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OSListViewProps {
  ordens: OrdemServico[];
  filters: any;
  setFilters: any;
  responsaveis: string[];
  onUpdateStatus: (id: string, status: StatusOS, comment?: string) => Promise<boolean>;
  onUpdateOrdem: (id: string, data: any) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onGetHistorico: (id: string) => Promise<any[]>;
  onRefresh?: () => void;
}

export function OSListView({ ordens, filters, setFilters, responsaveis, onUpdateStatus, onUpdateOrdem, onDelete, onGetHistorico, onRefresh }: OSListViewProps) {
  const [selectedOS, setSelectedOS] = useState<OrdemServico | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [expandedOS, setExpandedOS] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [finalizarServico, setFinalizarServico] = useState<{ ordem: OrdemServico; servico: ServicoOS } | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedOS(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const calcularTempoTotalOS = (ordem: OrdemServico): string => {
    const svcs = ordem.servicos || [];
    const datasInicio = svcs.map(s => s.data_inicio).filter(Boolean) as string[];
    if (datasInicio.length === 0) return '-';
    const primeira = new Date(Math.min(...datasInicio.map(d => new Date(d).getTime())));
    const todosFinalizados = svcs.every(s => s.status === 'Concluído');
    if (todosFinalizados) {
      const datasConclusao = svcs.map(s => s.data_conclusao).filter(Boolean) as string[];
      if (datasConclusao.length > 0) {
        const ultima = new Date(Math.max(...datasConclusao.map(d => new Date(d).getTime())));
        return `${differenceInDays(ultima, primeira)} dias`;
      }
    }
    return `${differenceInDays(new Date(), primeira)} dias (aberto)`;
  };

  const calcTempoServico = (inicio: string | null, fim: string | null): string => {
    if (!inicio) return '-';
    const end = fim ? new Date(fim) : new Date();
    return `${differenceInDays(end, new Date(inicio))} dias`;
  };

  return (
    <div className="space-y-6">
      <OSFilterBar filters={filters} setFilters={setFilters} responsaveis={responsaveis} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Lista de OS ({ordens.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ordens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma OS encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-muted-foreground w-8" />
                    <th className="pb-3 text-left font-medium text-muted-foreground">Nº OS</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Cliente</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground hidden md:table-cell">Serviços</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Responsável</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Status OS</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Tempo Total</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ordens.map(ordem => {
                    const isExpanded = expandedOS.has(ordem.id);
                    const svcs = ordem.servicos || [];
                    const concluidos = svcs.filter(s => s.status === 'Concluído').length;
                    return (
                      <React.Fragment key={ordem.id}>
                        <tr className="border-b hover:bg-muted/50 transition-colors">
                          <td className="py-3">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(ordem.id)}>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </td>
                          <td className="py-3 font-medium">{ordem.numero_os}</td>
                          <td className="py-3 max-w-[150px] truncate">{ordem.empresa_cliente}</td>
                          <td className="py-3 hidden md:table-cell text-muted-foreground">{concluidos}/{svcs.length} concluídos</td>
                          <td className="py-3 hidden lg:table-cell text-muted-foreground">{ordem.responsavel_atual.split(' ')[0]}</td>
                          <td className="py-3"><Badge className={statusOSColors[ordem.status_os] || 'bg-muted'}>{ordem.status_os}</Badge></td>
                          <td className="py-3 hidden xl:table-cell text-muted-foreground">{calcularTempoTotalOS(ordem)}</td>
                          <td className="py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedOS(ordem); setShowDetail(true); }}>
                                  <Eye className="mr-2 h-4 w-4" />Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedOS(ordem); setShowHistory(true); }}>
                                  <History className="mr-2 h-4 w-4" />Histórico
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteId(ordem.id)} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        {isExpanded && svcs.map(servico => (
                          <tr key={servico.id} className="bg-muted/30 border-b last:border-0">
                            <td className="py-2" />
                            <td className="py-2 pl-4 text-muted-foreground">↳</td>
                            <td className="py-2 font-medium">{servico.tipo}</td>
                            <td className="py-2 hidden md:table-cell">
                              <Badge variant={servico.tipo_os === 'Novo' ? 'default' : 'secondary'} className="text-xs">{servico.tipo_os}</Badge>
                            </td>
                            <td className="py-2 hidden lg:table-cell text-xs text-muted-foreground">
                              {servico.data_inicio ? format(parseISO(servico.data_inicio), 'dd/MM/yy', { locale: ptBR }) : '-'}
                              {' → '}
                              {servico.data_conclusao ? format(parseISO(servico.data_conclusao), 'dd/MM/yy', { locale: ptBR }) : 'Aberto'}
                            </td>
                            <td className="py-2"><Badge className={`text-xs ${statusServicoColors[servico.status] || 'bg-muted'}`}>{servico.status}</Badge></td>
                            <td className="py-2 hidden xl:table-cell text-muted-foreground text-xs">{calcTempoServico(servico.data_inicio, servico.data_conclusao)}</td>
                            <td className="py-2 text-right">
                              {servico.status !== 'Concluído' && (
                                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFinalizarServico({ ordem, servico })}>
                                  <CheckSquare className="h-3 w-3 mr-1" />Finalizar
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedOS && (
        <>
          <OSDetailDialog ordem={selectedOS} open={showDetail} onOpenChange={setShowDetail} onUpdateStatus={onUpdateStatus} />
          <OSHistoryDialog ordem={selectedOS} open={showHistory} onOpenChange={setShowHistory} onGetHistorico={onGetHistorico} />
        </>
      )}

      {finalizarServico && (
        <OSFinalizarServicoDialog
          open={!!finalizarServico}
          onOpenChange={() => setFinalizarServico(null)}
          ordem={finalizarServico.ordem}
          servico={finalizarServico.servico}
          onFinalized={() => { setFinalizarServico(null); onRefresh?.(); }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir OS</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
