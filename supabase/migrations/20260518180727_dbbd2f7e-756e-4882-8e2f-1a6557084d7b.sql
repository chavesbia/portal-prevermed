ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'aso_retificacao';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_email_pending
  ON public.notifications (email_pending)
  WHERE email_pending = true;