CREATE OR REPLACE FUNCTION public.soc_full_sync_scheduled()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_endpoint TEXT;
BEGIN
  -- Iterar sobre os endpoints reais implantados
  FOR v_endpoint IN SELECT unnest(ARRAY['soc-empresas-sync', 'soc-preco-sync', 'soc-responsaveis-pcmso-sync'])
  LOOP
    PERFORM net.http_post(
      url := 'https://woqyhugzztdjpkfwkolu.supabase.co/functions/v1/' || v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXlodWd6enRkanBrZndrb2x1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODczNzYzOSwiZXhwIjoyMDg0MzEzNjM5fQ.q0S_xPZ_f_m8_Z_z_x_x_x_x_x_x_x_x_x_x_x_x_x_x_x',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXlodWd6enRkanBrZndrb2x1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODczNzYzOSwiZXhwIjoyMDg0MzEzNjM5fQ.q0S_xPZ_f_m8_Z_z_x_x_x_x_x_x_x_x_x_x_x_x_x_x_x'
      ),
      body := jsonb_build_object('scheduled', true, 'triggered_at', now()),
      timeout_milliseconds := 60000
    );
  END LOOP;
END;
$function$;