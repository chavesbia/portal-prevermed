import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { OrdemServico, StatusOS, STATUS_OS_OPTIONS, statusOSColors } from '@/types/os';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OSDetailDialogProps {
  ordem: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (id: string, status: StatusOS, comment?: string) => Promise<boolean>;
}

export function OSDetailDialog({ ordem, open, onOpenChange, onUpdateStatus }: OSDetailDialogProps) {
  const [newStatus, setNewStatus] = useState<StatusOS>(ordem.status_os as StatusOS);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    if (newStatus !== ordem.status_os || comentario) {
      setSaving(true);
      await onUpdateStatus(ordem.id, newStatus, comentario);
      setSaving(false);
      setComentario('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>OS #{ordem.numero_os}</span>
            <Badge className={statusOSColors[ordem.status_os]}>{ordem.status_os}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Cliente</Label>
              <p className="font-medium">{ordem.empresa_cliente}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Contato</Label>
              <p className="font-medium">{ordem.contato_cliente || '-'}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Serviços</Label>
              <p className="font-medium">{ordem.tipo_servico_resumo || '-'}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Responsável</Label>
              <p className="font-medium">{ordem.responsavel_atual}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Data de Registro</Label>
              <p className="font-medium">{format(parseISO(ordem.data_registro), 'dd/MM/yyyy', { locale: ptBR })}</p>
            </div>
            {ordem.data_emissao && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Data de Emissão</Label>
                <p className="font-medium">{format(parseISO(ordem.data_emissao), 'dd/MM/yyyy', { locale: ptBR })}</p>
              </div>
            )}
          </div>

          {ordem.observacoes && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Observações</Label>
              <p className="rounded-lg bg-muted p-3 text-sm">{ordem.observacoes}</p>
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-semibold">Atualizar Status</h4>
            <div className="space-y-2">
              <Label>Novo Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as StatusOS)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comentário</Label>
              <Textarea placeholder="Adicione um comentário..." value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
