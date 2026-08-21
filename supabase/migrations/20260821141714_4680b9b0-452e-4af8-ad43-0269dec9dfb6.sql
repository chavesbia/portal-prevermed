CREATE OR REPLACE FUNCTION public.soc_full_sync_scheduled()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_endpoint TEXT;
  v_service_role_key TEXT;
BEGIN
  -- We must use the literal key here because app.settings.service_role_key is not accessible in the sandbox DB environment
  v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXlodWd6enRkanBrZndrb2x1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODczNzYzOSwiZXhwIjoyMDg0MzEzNjM5fQ.bwacfw1b0PL90Gv979BeP6M8p4112SU897QE9eGk8v0';
  
  FOR v_endpoint IN SELECT unnest(ARRAY['soc-empresas-sync', 'soc-preco-sync', 'soc-responsaveis-pcmso-sync'])
  LOOP
    PERFORM net.http_post(
      url := 'https://woqyhugzztdjpkfwkolu.supabase.co/functions/v1/' || v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_service_role_key,
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object('scheduled', true, 'triggered_at', now()),
      timeout_milliseconds := 60000
    );
  END LOOP;
END;
$function$;