import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  ordem: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileOption { user_id: string; full_name: string | null; }

const ENGENHARIA_DEPT_ID = '75667708-1efb-4c2e-87b1-70251eb7f412';

export function OSAgendarVisitaDialog({ ordem, open, onOpenChange }: Props) {
  const { addVisita } = useOSVisitas();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [servicoId, setServicoId] = useState<string>('none');
  const [dataVisita, setDataVisita] = useState<Date | undefined>();
  const [horaVisita, setHoraVisita] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [tipoVisita, setTipoVisita] = useState<VisitaTipo>('Visita Técnica');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [custoAprox, setCustoAprox] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [motivoUrgencia, setMotivoUrgencia] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: ud } = await supabase
        .from('user_departments')
        .select('user_id')
        .eq('department_id', ENGENHARIA_DEPT_ID);
      const ids = (ud || []).map((r: any) => r.user_id);
      if (ids.length === 0) { setProfiles([]); return; }
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('status', 'active')
        .in('user_id', ids)
        .order('full_name');
      setProfiles((data || []) as ProfileOption[]);
    })();
  }, [open]);

  const reset = () => {
    setServicoId('none'); setDataVisita(undefined); setHoraVisita(''); setResponsavelId('');
    setTipoVisita('Visita Técnica'); setEndereco(''); setObservacoes('');
    setCustoAprox(''); setUrgente(false); setMotivoUrgencia('');
  };

  const handleSubmit = async () => {
    if (!dataVisita) { toast({ title: 'Atenção', description: 'Selecione a data.', variant: 'destructive' }); return; }
    if (!responsavelId) { toast({ title: 'Atenção', description: 'Selecione o Elaborador/Executor.', variant: 'destructive' }); return; }
    if (urgente && !motivoUrgencia.trim()) { toast({ title: 'Atenção', description: 'Informe o motivo da urgência.', variant: 'destructive' }); return; }
    setSaving(true);
    const profile = profiles.find(p => p.user_id === responsavelId);
    const ok = await addVisita({
      empresa_cliente: ordem.empresa_cliente,
      ordem_id: ordem.id,
      numero_os: ordem.numero_os,
      servico_id: servicoId === 'none' ? null : servicoId,
      data_visita: format(dataVisita, 'yyyy-MM-dd'),
      hora_visita: horaVisita || null,
      responsavel_id: responsavelId,
      responsavel_nome: profile?.full_name || 'Sem nome',
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
            <Label>Elaborador/Executor *</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Salvando...' : 'Agendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
