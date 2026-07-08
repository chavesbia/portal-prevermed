import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  const [dataVisita, setDataVisita] = useState<Date | undefined>();
  const [horaVisita, setHoraVisita] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [tipoVisita, setTipoVisita] = useState<VisitaTipo>('Avaliação');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
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
    setDataVisita(undefined); setHoraVisita(''); setResponsavelId('');
    setTipoVisita('Avaliação'); setEndereco(''); setObservacoes('');
  };

  const handleSubmit = async () => {
    if (!dataVisita) { toast({ title: 'Atenção', description: 'Selecione a data.', variant: 'destructive' }); return; }
    if (!responsavelId) { toast({ title: 'Atenção', description: 'Selecione o responsável.', variant: 'destructive' }); return; }
    setSaving(true);
    const profile = profiles.find(p => p.user_id === responsavelId);
    const ok = await addVisita({
      empresa_cliente: ordem.empresa_cliente,
      ordem_id: ordem.id,
      numero_os: ordem.numero_os,
      data_visita: format(dataVisita, 'yyyy-MM-dd'),
      hora_visita: horaVisita || null,
      responsavel_id: responsavelId,
      responsavel_nome: profile?.full_name || 'Sem nome',
      tipo_visita: tipoVisita,
      endereco: endereco || null,
      observacoes: observacoes || null,
      custos_deslocamento: 0,
      equipamentos_ids: [],
    });
    setSaving(false);
    if (ok) { reset(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Visita — OS #{ordem.numero_os}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">Cliente: <span className="font-medium text-foreground">{ordem.empresa_cliente}</span></div>

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
            <Label>Responsável *</Label>
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
