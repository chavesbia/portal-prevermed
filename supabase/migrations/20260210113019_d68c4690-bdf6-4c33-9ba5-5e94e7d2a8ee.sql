
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  end_date DATE,
  event_type TEXT NOT NULL DEFAULT 'event' CHECK (event_type IN ('holiday', 'event', 'unit_schedule', 'training')),
  unit_id UUID REFERENCES public.units(id),
  department_id UUID REFERENCES public.departments(id),
  color TEXT DEFAULT '#22c55e',
  is_all_day BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view calendar events" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "Admins can insert calendar events" ON public.calendar_events FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update calendar events" ON public.calendar_events FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete calendar events" ON public.calendar_events FOR DELETE USING (is_adm_master());

CREATE INDEX idx_calendar_events_date ON public.calendar_events(event_date);
