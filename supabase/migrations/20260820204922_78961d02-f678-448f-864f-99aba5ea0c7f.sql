
CREATE OR REPLACE FUNCTION public.soc_full_sync_scheduled()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sync_endpoints text[] := ARRAY['soc-empresas-sync', 'soc-unidades-sync', 'soc-contatos-sync', 'soc-preco-sync', 'soc-responsaveis-pcmso-sync'];
  v_endpoint text;
BEGIN
  FOREACH v_endpoint IN ARRAY v_sync_endpoints LOOP
    PERFORM net.http_post(
      url := 'https://woqyhugzztdjpkfwkolu.supabase.co/functions/v1/' || v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', current_setting('request.headers', true)::jsonb->>'authorization'
      ),
      body := jsonb_build_object('scheduled', true),
      timeout_milliseconds := 60000
    );
  END LOOP;
END;
$function$;
