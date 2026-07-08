import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, AlertCircle, CheckSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OrdemServico, ServicoOS, StatusServico, STATUS_SERVICO_OPTIONS } from '@/types/os';
import { ProfissionalSelector } from '@/components/os/ProfissionalSelector';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ordem: OrdemServico;
  servico: ServicoOS;
  onSaved: () => void;
  onRequestFinalizar: () => void;
}

export function OSServicoEditDialog({ open, onOpenChange, ordem, servico, onSaved, onRequestFinalizar }: Props) {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<StatusServico>(servico.status);
  const [responsavelId, setResponsavelId] = useState<string | null>(servico.responsavel_id);
  const [dataInicio, setDataInicio] = useState<Date | null>(servico.data_inicio ? parseISO(servico.data_inicio) : null);
  const [dataConclusao, setDataConclusao] = useState<Date | null>(servico.data_conclusao ? parseISO(servico.data_conclusao) : null);
  const [observacoes, setObservacoes] = useState<string>(servico.observacoes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(servico.status);
      setResponsavelId(servico.responsavel_id);
      setDataInicio(servico.data_inicio ? parseISO(servico.data_inicio) : null);
      setDataConclusao(servico.data_conclusao ? parseISO(servico.data_conclusao) : null);
      setObservacoes(servico.observacoes || '');
    }
  }, [open, servico]);

  const isEncerrar = status === 'Encerrado';
  const statusChanged = status !== servico.status;

  const handleSave = async () => {
    if (isEncerrar) {
      onOpenChange(false);
      onRequestFinalizar();
      return;
    }
    if (statusChanged) {
      if (!responsavelId) {
        toast({ title: 'Atenção', description: 'Selecione o Responsável para alterar o status.', variant: 'destructive' });
        return;
      }
      if (!dataInicio) {
        toast({ title: 'Atenção', description: 'Informe a Data de início para alterar o status.', variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('servicos_os').update({
        status,
        responsavel_id: responsavelId,
        data_inicio: dataInicio ? format(dataInicio, 'yyyy-MM-dd') : null,
        data_conclusao: dataConclusao ? format(dataConclusao, 'yyyy-MM-dd') : null,
        observacoes: observacoes || null,
      } as any).eq('id', servico.id);
      if (error) throw error;

      if (statusChanged) {
        await supabase.from('historico_os').insert({
          ordem_id: ordem.id,
          user_id: user?.id || null,
          user_name: profile?.full_name || 'Sistema',
          acao: 'Atualização de Serviço',
          comentario: `Serviço ${servico.tipo}: status alterado de ${servico.status} para ${status}`,
          status_anterior: servico.status,
          status_novo: status,
          servico_afetado: servico.tipo,
        });
      }

      toast({ title: 'Salvo', description: 'Serviço atualizado.' });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Erro ao salvar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar Serviço</DialogTitle>
          <DialogDescription>
            OS {ordem.numero_os} — {ordem.empresa_cliente}<br />
            Serviço: <strong>{servico.tipo}</strong> ({servico.tipo_os})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Status do Serviço</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusServico)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_SERVICO_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {isEncerrar && (
              <div className="flex items-start gap-2 p-2 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-xs">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>Encerrar exige registro de laudo. Ao salvar, abriremos a tela de finalização com laudo.</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Responsável {statusChanged && <span className="text-destructive">*</span>}</Label>
            <ProfissionalSelector value={responsavelId} onChange={setResponsavelId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início {statusChanged && <span className="text-destructive">*</span>}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dataInicio && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio || undefined} onSelect={(d) => setDataInicio(d || null)} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data de Finalização</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dataConclusao && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataConclusao ? format(dataConclusao, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataConclusao || undefined} onSelect={(d) => setDataConclusao(d || null)} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Notas internas sobre o serviço" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {isEncerrar ? (<><CheckSquare className="mr-2 h-4 w-4" />Finalizar com Laudo</>) : (saving ? 'Salvando...' : 'Salvar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
