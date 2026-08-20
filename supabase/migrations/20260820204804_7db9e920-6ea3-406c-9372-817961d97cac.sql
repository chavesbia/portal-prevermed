
CREATE OR REPLACE FUNCTION public.soc_full_sync_scheduled()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sync_endpoints text[] := ARRAY['soc-empresas-sync', 'soc-unidades-sync', 'soc-contatos-sync', 'soc-preco-sync', 'soc-responsaveis-pcmso-sync'];
  v_endpoint text;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXlodWd6enRkanBrZndrb2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Mzc2MzksImV4cCI6MjA4NDMxMzYzOX0.bwacfw1b0PL90Gv979BeP6M8p4112SU897QE9eGk8v0';
BEGIN
  FOREACH v_endpoint IN ARRAY v_sync_endpoints LOOP
    PERFORM net.http_post(
      url := 'https://woqyhugzztdjpkfwkolu.supabase.co/functions/v1/' || v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon_key,
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('scheduled', true),
      timeout_milliseconds := 30000
    );
  END LOOP;
END;
$function$;
