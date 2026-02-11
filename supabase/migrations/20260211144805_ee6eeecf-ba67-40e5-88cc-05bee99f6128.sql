
-- Add time, location and attachment fields to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN time_start TIME WITHOUT TIME ZONE DEFAULT NULL,
  ADD COLUMN time_end TIME WITHOUT TIME ZONE DEFAULT NULL,
  ADD COLUMN location TEXT DEFAULT NULL,
  ADD COLUMN attachment_url TEXT DEFAULT NULL;
