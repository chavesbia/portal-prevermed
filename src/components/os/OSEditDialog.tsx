import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Save, Plus, Trash2, User } from 'lucide-react';
import { OrdemServico, StatusOS, STATUS_OS_OPTIONS, ServicoOS, TipoOS } from '@/types/os';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTiposServicoOS } from '@/hooks/useTiposServicoOS';
import { useProfissionais } from '@/hooks/useProfissionais';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface OSEditDialogProps {
  ordem: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responsaveis: string[];
  onUpdate: (id: string, data: any) => Promise<boolean>;
  canEdit?: boolean;
}

export function OSEditDialog({ ordem, open, onOpenChange, onUpdate, canEdit: canEditProp }: OSEditDialogProps) {
  const { user } = useAuth();
  const { tipos: tiposServicoDB } = useTiposServicoOS();
  const { profissionais } = useProfissionais();
  
  const [numeroOS, setNumeroOS] = useState(ordem.numero_os);
  const [empresaCliente, setEmpresaCliente] = useState(ordem.empresa_cliente);
  const [contatoCliente, setContatoCliente] = useState(ordem.contato_cliente || '');
  const [statusOS, setStatusOS] = useState<StatusOS>(ordem.status_os as StatusOS);
  const [dataEmissao, setDataEmissao] = useState<Date | undefined>(ordem.data_emissao ? parseISO(ordem.data_emissao) : (ordem.data_registro ? parseISO(ordem.data_registro) : undefined));
  const [prazoAcordado, setPrazoAcordado] = useState<Date | undefined>(ordem.prazo_acordado ? parseISO(ordem.prazo_acordado) : undefined);
  const [observacoes, setObservacoes] = useState(ordem.observacoes || '');
  const [urgente, setUrgente] = useState<boolean>(!!ordem.urgente);
  const [motivoUrgencia, setMotivoUrgencia] = useState<string>(ordem.motivo_urgencia || '');
  const [emissorNome, setEmissorNome] = useState<string>(ordem.responsavel_atual || '');
  const [servicos, setServicos] = useState<ServicoOS[]>(ordem.servicos || []);
  const [saving, setSaving] = useState(false);
  const [newServicoTipo, setNewServicoTipo] = useState('');
  const [newServicoTipoOS, setNewServicoTipoOS] = useState<TipoOS>('Novo');

  const { isAdmMaster } = useAuth();
  const isEmissor = user?.id === ordem.created_by;
  const isNaoIniciado = ordem.status_os === 'Não iniciado';
  const canEdit = canEditProp !== undefined ? canEditProp : (isAdmMaster || (isEmissor && isNaoIniciado));

  useEffect(() => {
    if (!open) return;
    setNumeroOS(ordem.numero_os);
    setEmpresaCliente(ordem.empresa_cliente);
    setContatoCliente(ordem.contato_cliente || '');
    setStatusOS(ordem.status_os as StatusOS);
    setDataEmissao(ordem.data_emissao ? parseISO(ordem.data_emissao) : (ordem.data_registro ? parseISO(ordem.data_registro) : undefined));
    setPrazoAcordado(ordem.prazo_acordado ? parseISO(ordem.prazo_acordado) : undefined);
    setObservacoes(ordem.observacoes || '');
    setUrgente(!!ordem.urgente);
    setMotivoUrgencia(ordem.motivo_urgencia || '');
    setEmissorNome(ordem.responsavel_atual || '');
    setServicos(ordem.servicos || []);
    setNewServicoTipo('');
    setNewServicoTipoOS('Novo');

    // Try to resolve emissor's real name from profiles (created_by)
    (async () => {
      if (ordem.created_by) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', ordem.created_by)
          .maybeSingle();
        if ((data as any)?.full_name) setEmissorNome((data as any).full_name);
      }
    })();
  }, [ordem, open]);

  const handleSave = async () => {
    if (!numeroOS || !empresaCliente || !dataEmissao) return;
    if (urgente && !motivoUrgencia.trim()) return;
    setSaving(true);
    const dataEmissaoStr = format(dataEmissao, 'yyyy-MM-dd');
    const ok = await onUpdate(ordem.id, {
      numero_os: numeroOS,
      empresa_cliente: empresaCliente,
      contato_cliente: contatoCliente || null,
      status_os: statusOS,
      data_registro: dataEmissaoStr,
      data_emissao: dataEmissaoStr,
      prazo_acordado: prazoAcordado ? format(prazoAcordado, 'yyyy-MM-dd') : null,
      observacoes: observacoes || null,
      urgente,
      motivo_urgencia: urgente ? motivoUrgencia : null,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  const handleAddServico = async () => {
    if (!newServicoTipo) return;
    try {
      const { data, error } = await supabase
        .from('servicos_os')
        .insert({
          ordem_id: ordem.id,
          tipo: newServicoTipo,
          tipo_os: newServicoTipoOS,
          status: 'Não iniciado'
        } as any)
        .select()
        .single();

      if (error) throw error;
      setServicos(prev => [...prev, data as ServicoOS]);
      setNewServicoTipo('');
      toast.success('Serviço adicionado');
    } catch (e: any) {
      toast.error('Erro ao adicionar serviço: ' + e.message);
    }
  };

  const handleRemoveServico = async (servicoId: string) => {
    try {
      const { error } = await supabase
        .from('servicos_os')
        .delete()
        .eq('id', servicoId);

      if (error) throw error;
      setServicos(prev => prev.filter(s => s.id !== servicoId));
      toast.success('Serviço removido');
    } catch (e: any) {
      toast.error('Erro ao remover serviço: ' + e.message);
    }
  };

  const dateField = (label: string, value: Date | undefined, onChange: (d: Date | undefined) => void) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !value && 'text-muted-foreground')}>
            {value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar OS #{ordem.numero_os}</DialogTitle>
          <DialogDescription>Atualize os dados da ordem de serviço.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Número da OS</Label>
            <Input value={numeroOS} onChange={(e) => setNumeroOS(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Empresa Cliente</Label>
            <Input value={empresaCliente} onChange={(e) => setEmpresaCliente(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contato do Cliente</Label>
            <Input value={contatoCliente} onChange={(e) => setContatoCliente(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Emissor da OS</Label>
            <Input value={emissorNome} readOnly disabled />
            <p className="text-xs text-muted-foreground">Definido automaticamente no cadastro da OS.</p>
          </div>
          <div className="space-y-2">
            <Label>Status da OS</Label>
            <Select value={statusOS} onValueChange={(v) => setStatusOS(v as StatusOS)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Normalmente automático conforme os serviços.</p>
          </div>
          {dateField('Data de Emissão', dataEmissao, setDataEmissao)}
          <div className="space-y-2">
            {dateField('Prazo de Entrega', prazoAcordado, setPrazoAcordado)}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox id="urg-edit" checked={urgente} onCheckedChange={(v) => setUrgente(!!v)} />
              <Label htmlFor="urg-edit" className="cursor-pointer text-sm">Urgente</Label>
            </div>
            {urgente && (
              <Textarea rows={2} placeholder="Motivo da urgência" value={motivoUrgencia} onChange={(e) => setMotivoUrgencia(e.target.value)} />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4} />
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Serviços</h3>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Select value={newServicoTipo} onValueChange={setNewServicoTipo}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Adicionar serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposServicoDB.filter(t => t.ativo).map(t => (
                      <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newServicoTipoOS} onValueChange={(v) => setNewServicoTipoOS(v as TipoOS)}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Revisão">Revisão</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" onClick={handleAddServico} disabled={!newServicoTipo}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-2 px-4 text-left font-medium">Serviço</th>
                  <th className="py-2 px-4 text-left font-medium">Status</th>
                  <th className="py-2 px-4 text-left font-medium">Executor</th>
                  {canEdit && <th className="py-2 px-4 text-right font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {servicos.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="py-8 text-center text-muted-foreground italic">
                      Nenhum serviço vinculado.
                    </td>
                  </tr>
                ) : (
                  servicos.map(s => {
                    const prof = profissionais.find(p => p.id === s.responsavel_id);
                    const canRemove = canEdit && s.status === 'Não iniciado';
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-4">
                          <div className="font-medium">{s.tipo}</div>
                          <Badge variant="outline" className="text-[10px] h-4 mt-0.5">{s.tipo_os}</Badge>
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant="secondary" className="text-xs">{s.status}</Badge>
                        </td>
                        <td className="py-2 px-4 text-muted-foreground text-xs">
                          {prof ? (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {prof.nome}
                            </div>
                          ) : '—'}
                        </td>
                        {canEdit && (
                          <td className="py-2 px-4 text-right">
                            {canRemove ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveServico(s.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground uppercase px-2 py-1 bg-muted rounded">Iniciado</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

