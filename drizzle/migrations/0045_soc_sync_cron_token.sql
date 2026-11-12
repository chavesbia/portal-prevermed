CREATE TABLE public.soc_sync_cron_token (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), token text NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'));
GRANT ALL ON public.soc_sync_cron_token TO service_role;
REVOKE ALL ON public.soc_sync_cron_token FROM anon, authenticated;
ALTER TABLE public.soc_sync_cron_token ENABLE ROW LEVEL SECURITY;
INSERT INTO public.soc_sync_cron_token (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.soc_full_sync_scheduled()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXlodWd6enRkanBrZndrb2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Mzc2MzksImV4cCI6MjA4NDMxMzYzOX0.bwacfw1b0PL90Gv979BeP6M8p4112SU897QE9eGk8v0';
  v_token text;
BEGIN
  SELECT token INTO v_token FROM public.soc_sync_cron_token WHERE id = 1;
  PERFORM net.http_post(
    url := 'https://woqyhugzztdjpkfwkolu.supabase.co/functions/v1/soc-full-sync-scheduled',
    headers := jsonb_build_object('Content-Type','application/json','apikey',v_key,'Authorization','Bearer '||v_key,'x-cron-token',v_token),
    body := jsonb_build_object('scheduled', true, 'triggered_at', now()),
    timeout_milliseconds := 10000);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Falha ao enfileirar sincronização SOC completa: %', SQLERRM;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.soc_full_sync_scheduled() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.agenda_rate_limit (ip text NOT NULL, janela timestamptz NOT NULL, total int NOT NULL DEFAULT 1, PRIMARY KEY (ip, janela));
GRANT ALL ON public.agenda_rate_limit TO service_role;
REVOKE ALL ON public.agenda_rate_limit FROM anon, authenticated;
ALTER TABLE public.agenda_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.agenda_rate_hit(_ip text, _limite int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_j timestamptz := date_trunc('minute', now()); v_total int;
BEGIN
  INSERT INTO agenda_rate_limit(ip, janela) VALUES (_ip, v_j)
  ON CONFLICT (ip, janela) DO UPDATE SET total = agenda_rate_limit.total + 1
  RETURNING total INTO v_total;
  IF random() < 0.01 THEN DELETE FROM agenda_rate_limit WHERE janela < now() - interval '1 hour'; END IF;
  RETURN v_total <= _limite;
END $$;
REVOKE EXECUTE ON FUNCTION public.agenda_rate_hit(text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_rate_hit(text,int) TO service_role;