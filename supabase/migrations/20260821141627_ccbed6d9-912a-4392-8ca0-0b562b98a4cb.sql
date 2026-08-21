CREATE OR REPLACE FUNCTION public.soc_full_sync_scheduled()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_endpoint TEXT;
BEGIN
  FOR v_endpoint IN SELECT unnest(ARRAY['soc-empresas-sync', 'soc-preco-sync', 'soc-responsaveis-pcmso-sync'])
  LOOP
    PERFORM net.http_post(
      url := 'https://woqyhugzztdjpkfwkolu.supabase.co/functions/v1/' || v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('scheduled', true, 'triggered_at', now()),
      timeout_milliseconds := 60000
    );
  END LOOP;
END;
$function$;