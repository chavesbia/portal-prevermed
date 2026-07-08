import { useState, useEffect } from 'react';
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
import { CalendarIcon, Save } from 'lucide-react';
import { OrdemServico, StatusOS, STATUS_OS_OPTIONS } from '@/types/os';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface OSEditDialogProps {
  ordem: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responsaveis: string[];
  onUpdate: (id: string, data: any) => Promise<boolean>;
}

export function OSEditDialog({ ordem, open, onOpenChange, onUpdate }: OSEditDialogProps) {
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
  const [saving, setSaving] = useState(false);

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

