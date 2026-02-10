import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit,
  PartyPopper,
  Building2,
  GraduationCap,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: string;
  unit_id: string | null;
  department_id: string | null;
  color: string | null;
  created_at: string;
}

interface Unit {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

const EVENT_TYPES = [
  { value: 'holiday', label: 'Feriado', icon: PartyPopper, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'event', label: 'Evento', icon: CalendarIcon, color: 'bg-primary/10 text-primary' },
  { value: 'unit_schedule', label: 'Unidade', icon: Building2, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'training', label: 'Treinamento', icon: GraduationCap, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
];

const getEventType = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[1];

export default function Calendario() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [form, setForm] = useState({
    title: '',
    description: '',
    event_date: '',
    end_date: '',
    event_type: 'event',
    unit_id: '',
    department_id: '',
  });

  useEffect(() => {
    fetchEvents();
    fetchUnits();
    fetchDepartments();
  }, [selectedYear]);

  const fetchEvents = async () => {
    setIsLoading(true);
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', yearStart)
      .lte('event_date', yearEnd)
      .order('event_date');

    if (error) {
      console.error('Error fetching events:', error);
      toast.error('Erro ao carregar eventos');
    } else {
      setEvents(data || []);
    }
    setIsLoading(false);
  };

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('id, name').eq('is_active', true).order('name');
    setUnits(data || []);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    setDepartments(data || []);
  };

  const openNewDialog = () => {
    setEditingEvent(null);
    setForm({ title: '', description: '', event_date: '', end_date: '', event_type: 'event', unit_id: '', department_id: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      end_date: event.end_date || '',
      event_type: event.event_type,
      unit_id: event.unit_id || '',
      department_id: event.department_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.event_date) {
      toast.error('Título e data são obrigatórios');
      return;
    }

    const payload = {
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      end_date: form.end_date || null,
      event_type: form.event_type,
      unit_id: form.unit_id || null,
      department_id: form.department_id || null,
    };

    if (editingEvent) {
      const { error } = await supabase
        .from('calendar_events')
        .update(payload)
        .eq('id', editingEvent.id);

      if (error) {
        toast.error('Erro ao atualizar evento');
        return;
      }
      toast.success('Evento atualizado');
    } else {
      const { error } = await supabase
        .from('calendar_events')
        .insert(payload);

      if (error) {
        toast.error('Erro ao criar evento');
        return;
      }
      toast.success('Evento criado');
    }

    setIsDialogOpen(false);
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este evento?')) return;

    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir evento');
      return;
    }
    toast.success('Evento excluído');
    fetchEvents();
  };

  // Group events by month
  const months = eachMonthOfInterval({
    start: startOfYear(new Date(selectedYear, 0, 1)),
    end: endOfYear(new Date(selectedYear, 0, 1)),
  });

  const getEventsForMonth = (monthDate: Date) => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    return events.filter(e => {
      const d = parseISO(e.event_date);
      return d >= start && d <= end;
    });
  };

  const formatEventDate = (dateStr: string) => {
    return format(parseISO(dateStr), "dd/MMM", { locale: ptBR });
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Calendário Corporativo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Eventos, feriados e cronograma das unidades
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button onClick={openNewDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Evento
            </Button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2"><div className="h-5 bg-muted rounded w-24" /></CardHeader>
              <CardContent><div className="h-16 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {months.map((monthDate) => {
            const monthEvents = getEventsForMonth(monthDate);
            const monthName = format(monthDate, 'MMMM', { locale: ptBR });
            const hasEvents = monthEvents.length > 0;

            return (
              <Card key={monthDate.toISOString()} className={hasEvents ? 'card-elevated' : 'opacity-70'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base capitalize flex items-center justify-between">
                    <span className={hasEvents ? 'text-primary font-bold' : ''}>
                      {monthName}
                    </span>
                    {hasEvents && (
                      <Badge variant="secondary" className="text-xs">
                        {monthEvents.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {!hasEvents ? (
                    <p className="text-xs text-muted-foreground py-2">Sem eventos</p>
                  ) : (
                    <div className="space-y-1.5">
                      {monthEvents.map((event) => {
                        const eventType = getEventType(event.event_type);
                        const Icon = eventType.icon;
                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
                          >
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${eventType.color}`}>
                              {formatEventDate(event.event_date)}
                            </Badge>
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-sm truncate flex-1" title={event.title}>
                              {event.title}
                            </span>
                            {isAdmin && (
                              <div className="hidden group-hover:flex items-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(event)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(event.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Carnaval, Palestra NR-1" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes do evento..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Início *</Label>
                <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit_id} onValueChange={v => setForm(f => ({ ...f, unit_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editingEvent ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
