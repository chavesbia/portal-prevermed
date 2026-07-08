import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { OrdemServico, HistoricoOS, statusOSColors } from '@/types/os';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight, Plus, Pencil, RefreshCw, CheckCircle2, CalendarPlus, FileText,
  MessageSquare, Lock, AlertTriangle, Activity,
} from 'lucide-react';

interface OSHistoryDialogProps {
  ordem: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGetHistorico: (id: string) => Promise<HistoricoOS[]>;
}

// Map action to icon + color class
function actionIcon(acao: string) {
  const a = acao.toLowerCase();
  if (a.includes('criação') || a.includes('criacao')) return { Icon: Plus, tone: 'bg-primary text-primary-foreground' };
  if (a.includes('edição') || a.includes('edicao')) return { Icon: Pencil, tone: 'bg-blue-500 text-white' };
  if (a.includes('encerr')) return { Icon: Lock, tone: 'bg-emerald-600 text-white' };
  if (a.includes('finaliz')) return { Icon: CheckCircle2, tone: 'bg-emerald-600 text-white' };
  if (a.includes('agend') || a.includes('visita')) return { Icon: CalendarPlus, tone: 'bg-purple-500 text-white' };
  if (a.includes('status')) return { Icon: RefreshCw, tone: 'bg-yellow-500 text-white' };
  if (a.includes('laudo')) return { Icon: FileText, tone: 'bg-indigo-500 text-white' };
  if (a.includes('comentário') || a.includes('comentario')) return { Icon: MessageSquare, tone: 'bg-slate-500 text-white' };
  if (a.includes('alerta') || a.includes('atras')) return { Icon: AlertTriangle, tone: 'bg-destructive text-destructive-foreground' };
  return { Icon: Activity, tone: 'bg-muted text-muted-foreground' };
}

function groupLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function OSHistoryDialog({ ordem, open, onOpenChange, onGetHistorico }: OSHistoryDialogProps) {
  const [historico, setHistorico] = useState<HistoricoOS[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      onGetHistorico(ordem.id).then(data => {
        // Sort desc (most recent first) to match original
        const sorted = [...data].sort((a, b) => b.created_at.localeCompare(a.created_at));
        setHistorico(sorted);
        setLoading(false);
      });
    }
  }, [open, ordem.id]);

  const grupos = useMemo(() => {
    const map = new Map<string, HistoricoOS[]>();
    historico.forEach(h => {
      const key = h.created_at.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    });
    return Array.from(map.entries());
  }, [historico]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Histórico da OS #{ordem.numero_os}</span>
            <Badge variant="outline" className="text-xs">{historico.length} evento{historico.length !== 1 ? 's' : ''}</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : historico.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum evento registrado.</div>
        ) : (
          <div className="space-y-6 pt-2">
            {grupos.map(([dateKey, items]) => (
              <div key={dateKey} className="space-y-3">
                <div className="sticky top-0 z-10 -mx-6 px-6 py-2 bg-background/95 backdrop-blur border-b">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {groupLabel(dateKey)}
                  </span>
                </div>

                <div className="relative pl-3">
                  {/* vertical rail */}
                  <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-4">
                    {items.map(item => {
                      const { Icon, tone } = actionIcon(item.acao);
                      const mudouStatus =
                        item.status_anterior && item.status_novo && item.status_anterior !== item.status_novo;
                      return (
                        <div key={item.id} className="relative flex gap-4">
                          <div className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm ${tone}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 space-y-2 rounded-lg border bg-card p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold">{item.acao}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(item.created_at), 'HH:mm', { locale: ptBR })}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              por <span className="font-medium text-foreground">{item.user_name || 'Sistema'}</span>
                              {item.servico_afetado && (
                                <> · serviço <span className="font-medium text-foreground">{item.servico_afetado}</span></>
                              )}
                            </div>
                            {item.comentario && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.comentario}</p>
                            )}
                            {mudouStatus && (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Badge className={`text-xs ${statusOSColors[item.status_anterior!] || 'bg-muted'}`}>
                                  {item.status_anterior}
                                </Badge>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                <Badge className={`text-xs ${statusOSColors[item.status_novo!] || 'bg-muted'}`}>
                                  {item.status_novo}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
