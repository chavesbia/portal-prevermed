import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, ArrowRight, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, addDays, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  end_date: string | null;
  event_type: string;
  color: string | null;
  location: string | null;
  time_start: string | null;
  time_end: string | null;
  is_all_day: boolean | null;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  holiday: 'Feriado',
  event: 'Evento',
  training: 'Treinamento',
  meeting: 'Reunião',
};

export function CalendarPreviewCard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const endRange = format(addDays(new Date(), 5), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('calendar_events')
        .select('id, title, event_date, end_date, event_type, color, location, time_start, time_end, is_all_day')
        .or(`event_date.gte.${today},end_date.gte.${today}`)
        .lte('event_date', endRange)
        .order('event_date');

      if (data) setEvents(data);
    };
    fetchEvents();
  }, []);

  const formatEventDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hoje';
    return format(date, "dd 'de' MMM", { locale: ptBR });
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-5 w-5 text-primary" />
          Próximos Eventos
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/calendario')}>
          Ver calendário <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum evento nos próximos dias
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{event.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatEventDate(event.event_date)}
                    </span>
                    {event.time_start && !event.is_all_day && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {event.time_start.slice(0, 5)}
                      </span>
                    )}
                    {event.location && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
