import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { OrdemServico } from '@/types/os';
import { VISITA_TIPO_OPTIONS, VisitaTipo } from '@/types/osVisitas';
import { useOSVisitas } from '@/hooks/useOSVisitas';
import { useProfissionais } from '@/hooks/useProfissionais';
import { ProfissionalSelector } from '@/components/os/ProfissionalSelector';
import { toast } from '@/hooks/use-toast';

interface Props {
  ordem: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OSAgendarVisitaDialog({ ordem, open, onOpenChange }: Props) {
  const { addVisita, detectConflitos } = useOSVisitas();
  const { profissionais } = useProfissionais();
  const [servicoId, setServicoId] = useState<string>('none');
  const [dataVisita, setDataVisita] = useState<Date | undefined>();
  const [horaVisita, setHoraVisita] = useState('');
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [tipoVisita, setTipoVisita] = useState<VisitaTipo>('Visita Técnica');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [custoAprox, setCustoAprox] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [motivoUrgencia, setMotivoUrgencia] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setServicoId('none'); setDataVisita(undefined); setHoraVisita(''); setResponsavelId(null);
    setTipoVisita('Visita Técnica'); setEndereco(''); setObservacoes('');
    setCustoAprox(''); setUrgente(false); setMotivoUrgencia('');
  };

  const conflitos = useMemo(() => {
    if (!dataVisita) return [];
    return detectConflitos(format(dataVisita, 'yyyy-MM-dd'), [], responsavelId || null, horaVisita || null);
  }, [dataVisita, responsavelId, horaVisita, detectConflitos]);
  const hasBloqueio = conflitos.some(c => c.severity === 'error');

  const handleSubmit = async () => {
    if (!dataVisita) { toast({ title: 'Atenção', description: 'Selecione a data.', variant: 'destructive' }); return; }
    if (!responsavelId) { toast({ title: 'Atenção', description: 'Selecione o Executor.', variant: 'destructive' }); return; }
    if (urgente && !motivoUrgencia.trim()) { toast({ title: 'Atenção', description: 'Informe o motivo da urgência.', variant: 'destructive' }); return; }
    if (hasBloqueio) { toast({ title: 'Conflito', description: 'Resolva os conflitos de agenda antes de salvar.', variant: 'destructive' }); return; }
    setSaving(true);
    const profissional = profissionais.find(p => p.id === responsavelId);
    const ok = await addVisita({
      empresa_cliente: ordem.empresa_cliente,
      ordem_id: ordem.id,
      numero_os: ordem.numero_os,
      servico_id: servicoId === 'none' ? null : servicoId,
      data_visita: format(dataVisita, 'yyyy-MM-dd'),
      hora_visita: horaVisita || null,
      responsavel_id: responsavelId,
      responsavel_nome: profissional?.nome || 'Sem nome',
      tipo_visita: tipoVisita,
      endereco: endereco || null,
      observacoes: observacoes || null,
      custos_deslocamento: parseFloat(custoAprox || '0') || 0,
      urgente,
      motivo_urgencia: urgente ? motivoUrgencia : null,
      equipamentos_ids: [],
    });
    setSaving(false);
    if (ok) { reset(); onOpenChange(false); }
  };

  const servicos = ordem.servicos || [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Visita — OS #{ordem.numero_os}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">Cliente: <span className="font-medium text-foreground">{ordem.empresa_cliente}</span></div>

          {servicos.length > 0 && (
            <div className="space-y-2">
              <Label>Serviço da OS</Label>
              <Select value={servicoId} onValueChange={setServicoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— OS inteira —</SelectItem>
                  {servicos.map(s => <SelectItem key={s.id} value={s.id}>{s.tipo} ({s.tipo_os})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start', !dataVisita && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVisita ? format(dataVisita, 'dd/MM/yyyy') : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataVisita} onSelect={setDataVisita} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input type="time" value={horaVisita} onChange={e => setHoraVisita(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Executor *</Label>
            <ProfissionalSelector value={responsavelId} onChange={setResponsavelId} onlyExecutores />
          </div>


          <div className="space-y-2">
            <Label>Tipo de Visita *</Label>
            <Select value={tipoVisita} onValueChange={(v) => setTipoVisita(v as VisitaTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISITA_TIPO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Local da visita" />
          </div>

          <div className="space-y-2">
            <Label>Custo Aproximado (deslocamento, equipamentos etc.) R$</Label>
            <Input type="number" step="0.01" min="0" value={custoAprox} onChange={e => setCustoAprox(e.target.value)} placeholder="0,00" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="urgente-visita" checked={urgente} onCheckedChange={(v) => setUrgente(!!v)} />
              <Label htmlFor="urgente-visita" className="cursor-pointer">Urgente</Label>
            </div>
            {urgente && (
              <Textarea rows={2} placeholder="Motivo da urgência" value={motivoUrgencia} onChange={(e) => setMotivoUrgencia(e.target.value)} />
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>
          {conflitos.length > 0 && (
            <Alert variant={hasBloqueio ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  {conflitos.map((c, i) => (
                    <li key={i} className={c.severity === 'warn' ? 'text-amber-700' : undefined}>
                      {c.severity === 'warn' ? '⚠ ' : ''}{c.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || hasBloqueio}>{saving ? 'Salvando...' : 'Agendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
