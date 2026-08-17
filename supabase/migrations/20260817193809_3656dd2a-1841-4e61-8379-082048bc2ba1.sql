
-- 1. Cria a função que dispara as sincronizações (empresas, unidades, contatos, preco, responsaveis_pcmso)
CREATE OR REPLACE FUNCTION public.soc_full_sync_scheduled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sync_endpoints text[] := ARRAY['soc-empresas-sync', 'soc-unidades-sync', 'soc-contatos-sync', 'soc-preco-sync', 'soc-responsaveis-pcmso-sync'];
  v_endpoint text;
BEGIN
  FOREACH v_endpoint IN ARRAY v_sync_endpoints LOOP
    PERFORM net.http_post(
      url := 'https://woqyhugzztdjpkfwkolu.supabase.co/functions/v1/' || v_endpoint,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXlodWd6enRkanBrZndrb2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Mzc2MzksImV4cCI6MjA4NDMxMzYzOX0.bwacfw1b0PL90Gv979BeP6M8p4112SU897QE9eGk8v0"}'::jsonb,
      body := jsonb_build_object('scheduled', true)
    );
  END LOOP;
END;
$$;

-- 2. Agenda a execução 3 vezes ao dia (06:00, 12:00, 19:00 BRT)
-- Brasília (UTC-3) -> 09:00, 15:00, 22:00 UTC
-- Tentamos remover antes caso já existam por algum motivo
DO $$ 
BEGIN
    PERFORM cron.unschedule('soc-full-sync-6am');
EXCEPTION WHEN OTHERS THEN END; $$;

DO $$ 
BEGIN
    PERFORM cron.unschedule('soc-full-sync-12pm');
EXCEPTION WHEN OTHERS THEN END; $$;

DO $$ 
BEGIN
    PERFORM cron.unschedule('soc-full-sync-7pm');
EXCEPTION WHEN OTHERS THEN END; $$;

SELECT cron.schedule('soc-full-sync-6am', '0 9 * * *', 'SELECT public.soc_full_sync_scheduled();');
SELECT cron.schedule('soc-full-sync-12pm', '0 15 * * *', 'SELECT public.soc_full_sync_scheduled();');
SELECT cron.schedule('soc-full-sync-7pm', '0 22 * * *', 'SELECT public.soc_full_sync_scheduled();');
