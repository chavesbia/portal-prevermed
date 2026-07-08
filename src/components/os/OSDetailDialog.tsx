import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { OrdemServico, StatusOS, STATUS_OS_OPTIONS, statusOSColors } from '@/types/os';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { OSCustosTab } from './OSCustosTab';
import { OSFinanceiroTab } from './OSFinanceiroTab';
import { useModulePermissions } from '@/hooks/useModulePermissions';

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
  const [emissorNome, setEmissorNome] = useState<string | null>(null);
  const { getModulePermissions } = useModulePermissions();
  const canEdit = getModulePermissions('/gestao-os')?.can_edit ?? false;


  useEffect(() => {
    if (!open || !ordem.created_by) { setEmissorNome(null); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', ordem.created_by)
        .maybeSingle();
      setEmissorNome((data as any)?.full_name || null);
    })();
  }, [open, ordem.created_by]);

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>OS #{ordem.numero_os}</span>
            <Badge className={statusOSColors[ordem.status_os]}>{ordem.status_os}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalhes" className="mt-2">
          <TabsList>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="mt-4">
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
                {(emissorNome || ordem.created_by) && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Emissor</Label>
                    <p className="font-medium">{emissorNome || '—'}</p>
                  </div>
                )}
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
          </TabsContent>

          <TabsContent value="custos" className="mt-4">
            <OSCustosTab ordem={ordem} canEdit={canEdit} />
          </TabsContent>
        </Tabs>


      </DialogContent>
    </Dialog>
  );
}
