import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Trash2, History, MoreHorizontal, ChevronDown, ChevronRight, CheckSquare, CalendarPlus } from 'lucide-react';
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { OSFilterBar } from '@/components/os/OSFilterBar';
import { OSDetailDialog } from '@/components/os/OSDetailDialog';
import { OSHistoryDialog } from '@/components/os/OSHistoryDialog';
import { OSEditDialog } from '@/components/os/OSEditDialog';
import { OSFinalizarServicoDialog } from '@/components/os/OSFinalizarServicoDialog';
import { OSAgendarVisitaDialog } from '@/components/os/OSAgendarVisitaDialog';
import { OSServicoEditDialog } from '@/components/os/OSServicoEditDialog';
import { supabase } from '@/integrations/supabase/client';
import { OrdemServico, ServicoOS, statusOSColors, statusServicoColors, StatusOS, slaStatusColors } from '@/types/os';
import { calcOSSLA } from '@/lib/os/sla';
import { useFeriados } from '@/hooks/useFeriados';
import { useProfissionais } from '@/hooks/useProfissionais';
import { useAuth } from '@/contexts/AuthContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
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
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalCount?: number;
}

export function OSListView({ 
  ordens, 
  filters, 
  setFilters, 
  responsaveis, 
  onUpdateStatus, 
  onUpdateOrdem, 
  onDelete, 
  onGetHistorico, 
  onRefresh,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalCount = 0
}: OSListViewProps) {
  const { data: feriadosData } = useFeriados();
  const { profissionais } = useProfissionais();
  const feriados = feriadosData || [];
  const [selectedOS, setSelectedOS] = useState<OrdemServico | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAgendar, setShowAgendar] = useState(false);
  const [expandedOS, setExpandedOS] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [finalizarServico, setFinalizarServico] = useState<{ ordem: OrdemServico; servico: ServicoOS } | null>(null);
  const [editServico, setEditServico] = useState<{ ordem: OrdemServico; servico: ServicoOS } | null>(null);

  const { user, isAdmMaster } = useAuth();
  const { getModulePermissions } = useModulePermissions();
  const permissions = getModulePermissions('/gestao-os');
  const hasGlobalEdit = permissions?.can_edit ?? false;

  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    const osId = searchParams.get('os');
    if (!osId || autoOpenedRef.current === osId) return;
    const found = ordens.find(o => o.id === osId);
    if (found) {
      autoOpenedRef.current = osId;
      setSelectedOS(found);
      setShowDetail(true);
      const next = new URLSearchParams(searchParams);
      next.delete('os');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, ordens, setSearchParams]);

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
    const todosFinalizados = svcs.every(s => s.status === 'Encerrado');
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
          <CardTitle className="text-lg">Lista de OS ({totalCount})</CardTitle>
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
                    <th className="pb-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Data de Emissão</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground hidden md:table-cell">Serviços</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Status OS</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">SLA</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Tempo Total</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ordens.map(ordem => {
                    const isExpanded = expandedOS.has(ordem.id);
                    const svcs = ordem.servicos || [];
                    const concluidos = svcs.filter(s => s.status === 'Encerrado').length;
                    const sla = calcOSSLA({
                      data_registro: ordem.data_registro,
                      prazo_acordado: ordem.prazo_acordado,
                      status_os: ordem.status_os,
                      updated_at: ordem.updated_at,
                      feriados,
                    });
                    return (
                      <React.Fragment key={ordem.id}>
                        <tr className="border-b hover:bg-muted/50 transition-colors">
                          <td className="py-3">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(ordem.id)}>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </td>
                          <td className="py-3 font-medium">
                            {ordem.numero_os}
                            {(ordem as any).urgente && <Badge variant="destructive" className="ml-2 text-[10px]">URGENTE</Badge>}
                          </td>
                          <td className="py-3 max-w-[150px] truncate">{ordem.empresa_cliente}</td>
                          <td className="py-3 hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                            {ordem.data_registro ? format(parseISO(ordem.data_registro), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                          </td>
                          <td className="py-3 hidden md:table-cell text-muted-foreground">{concluidos}/{svcs.length} encerrados</td>
                          <td className="py-3"><Badge className={statusOSColors[ordem.status_os] || 'bg-muted'}>{ordem.status_os}</Badge></td>
                          <td className="py-3"><Badge variant="outline" className={slaStatusColors[sla.status]}>{sla.label}</Badge></td>
                          <td className="py-3 hidden xl:table-cell text-muted-foreground">{calcularTempoTotalOS(ordem)}</td>
                          <td className="py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedOS(ordem); setShowDetail(true); }}>
                                  <Eye className="mr-2 h-4 w-4" />Visualizar
                                </DropdownMenuItem>
                                {(hasGlobalEdit || (user?.id === ordem.created_by && ordem.status_os === 'Não iniciado')) && (
                                  <DropdownMenuItem onClick={() => { setSelectedOS(ordem); setShowEdit(true); }}>
                                    <Pencil className="mr-2 h-4 w-4" />Editar
                                  </DropdownMenuItem>
                                )}
                                {hasGlobalEdit && (
                                  <DropdownMenuItem onClick={() => { setSelectedOS(ordem); setShowAgendar(true); }}>
                                    <CalendarPlus className="mr-2 h-4 w-4" />Agendar Visita
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => { setSelectedOS(ordem); setShowHistory(true); }}>
                                  <History className="mr-2 h-4 w-4" />Histórico
                                </DropdownMenuItem>
                                {isAdmMaster && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDeleteId(ordem.id)} className="text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />Excluir
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        {isExpanded && svcs.map(servico => {
                          const prof = profissionais.find(p => p.id === servico.responsavel_id);
                          return (
                          <tr
                            key={servico.id}
                            className="bg-muted/30 border-b last:border-0 hover:bg-muted/60"
                          >
                            <td className="py-2" />
                            <td className="py-2 pl-4 text-muted-foreground">↳</td>
                            <td className="py-2">
                              <div className="font-medium">{servico.tipo}</div>
                              <div className="text-xs text-muted-foreground">
                                Executor: {prof?.nome || <span className="italic">— não atribuído —</span>}
                              </div>
                            </td>
                            <td className="py-2 hidden md:table-cell">
                              <Badge variant={servico.tipo_os === 'Novo' ? 'default' : 'secondary'} className="text-xs">{servico.tipo_os}</Badge>
                            </td>
                            <td className="py-2"><Badge className={`text-xs ${statusServicoColors[servico.status] || 'bg-muted'}`}>{servico.status}</Badge></td>
                            <td className="py-2 hidden lg:table-cell text-xs text-muted-foreground">
                              {servico.data_inicio ? format(parseISO(servico.data_inicio), 'dd/MM/yy', { locale: ptBR }) : '-'}
                              {' → '}
                              {servico.data_conclusao ? format(parseISO(servico.data_conclusao), 'dd/MM/yy', { locale: ptBR }) : 'Aberto'}
                            </td>
                            <td className="py-2 hidden xl:table-cell text-muted-foreground text-xs">{calcTempoServico(servico.data_inicio, servico.data_conclusao)}</td>
                            <td className="py-2 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditServico({ ordem, servico })}>
                                    <Pencil className="mr-2 h-4 w-4" />Editar
                                  </DropdownMenuItem>
                                  {servico.status !== 'Encerrado' && (
                                    <DropdownMenuItem onClick={() => setFinalizarServico({ ordem, servico })}>
                                      <CheckSquare className="mr-2 h-4 w-4" />Finalizar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) onPageChange?.(currentPage - 1);
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      return Math.abs(page - currentPage) <= 1;
                    })
                    .map((page, i, arr) => {
                      const showEllipsis = i > 0 && page - arr[i-1] > 1;
                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={page === currentPage}
                              onClick={(e) => {
                                e.preventDefault();
                                onPageChange?.(page);
                              }}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </React.Fragment>
                      );
                    })}

                  <PaginationItem>
                    <PaginationNext 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) onPageChange?.(currentPage + 1);
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedOS && (
        <>
          <OSDetailDialog ordem={selectedOS} open={showDetail} onOpenChange={setShowDetail} onUpdateStatus={onUpdateStatus} />
          <OSEditDialog 
            ordem={selectedOS} 
            open={showEdit} 
            onOpenChange={setShowEdit} 
            responsaveis={responsaveis} 
            onUpdate={onUpdateOrdem}
            canEdit={hasGlobalEdit || (user?.id === selectedOS?.created_by && selectedOS?.status_os === 'Não iniciado')}
          />
          <OSHistoryDialog ordem={selectedOS} open={showHistory} onOpenChange={setShowHistory} onGetHistorico={onGetHistorico} />
          <OSAgendarVisitaDialog ordem={selectedOS} open={showAgendar} onOpenChange={setShowAgendar} />
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

      {editServico && (
        <OSServicoEditDialog
          open={!!editServico}
          onOpenChange={(o) => !o && setEditServico(null)}
          ordem={editServico.ordem}
          servico={editServico.servico}
          onSaved={() => { setEditServico(null); onRefresh?.(); }}
          onRequestFinalizar={() => setFinalizarServico(editServico)}
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
