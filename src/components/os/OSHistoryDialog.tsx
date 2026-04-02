import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { OrdemServico, HistoricoOS, statusOSColors } from '@/types/os';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';

interface OSHistoryDialogProps {
  ordem: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGetHistorico: (id: string) => Promise<HistoricoOS[]>;
}

export function OSHistoryDialog({ ordem, open, onOpenChange, onGetHistorico }: OSHistoryDialogProps) {
  const [historico, setHistorico] = useState<HistoricoOS[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      onGetHistorico(ordem.id).then(data => {
        setHistorico(data);
        setLoading(false);
      });
    }
  }, [open, ordem.id]);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da OS #{ordem.numero_os}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : historico.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum histórico encontrado.</div>
        ) : (
          <div className="relative space-y-4">
            {historico.map((item, index) => (
              <div key={item.id} className="relative flex gap-4">
                {index < historico.length - 1 && (
                  <div className="absolute left-5 top-12 h-full w-0.5 bg-border" />
                )}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {item.user_name ? getInitials(item.user_name) : '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2 rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.user_name || 'Sistema'}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="font-medium text-sm">{item.acao}</p>
                  {item.comentario && <p className="text-sm text-muted-foreground">{item.comentario}</p>}
                  {item.status_anterior && item.status_novo && item.status_anterior !== item.status_novo && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Badge className={`text-xs ${statusOSColors[item.status_anterior] || 'bg-muted'}`}>{item.status_anterior}</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge className={`text-xs ${statusOSColors[item.status_novo] || 'bg-muted'}`}>{item.status_novo}</Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
