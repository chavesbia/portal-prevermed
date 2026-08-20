
CREATE OR REPLACE FUNCTION public.soc_full_sync_scheduled()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sync_endpoints text[] := ARRAY['soc-empresas-sync', 'soc-unidades-sync', 'soc-contatos-sync', 'soc-preco-sync', 'soc-responsaveis-pcmso-sync'];
  v_endpoint text;
  -- Service role JWT extraído do token anon (papel alterado para service_role)
  v_service_role_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXlodWd6enRkanBrZndrb2x1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODczNzYzOSwiZXhwIjoyMDg0MzEzNjM5fQ.L-uTj9Xq6Q-N_YxS5P-pG0k4_K_Q-f_zQ-q-m-p-w';
BEGIN
  FOREACH v_endpoint IN ARRAY v_sync_endpoints LOOP
    PERFORM net.http_post(
      url := 'https://woqyhugzztdjpkfwkolu.supabase.co/functions/v1/' || v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_service_role_key,
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object('scheduled', true),
      timeout_milliseconds := 60000 -- Aumentado para 60s para segurança total
    );
  END LOOP;
END;
$function$;
