ALTER TYPE public.aso_exame_status ADD VALUE IF NOT EXISTS 'aguardando' BEFORE 'pendente';
ALTER TYPE public.aso_exame_status ADD VALUE IF NOT EXISTS 'nova_coleta';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'aso_alerta';