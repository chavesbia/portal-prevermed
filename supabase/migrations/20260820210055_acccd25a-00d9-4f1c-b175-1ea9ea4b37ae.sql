-- 1. Limpar e recriar agendamentos via migration para contornar transação read-only
SELECT cron.unschedule(jobid) FROM cron.job WHERE command ILIKE '%soc_full_sync_scheduled%';

SELECT cron.schedule('soc-sync-06h', '0 9 * * *', 'SELECT public.soc_full_sync_scheduled();');
SELECT cron.schedule('soc-sync-12h', '0 15 * * *', 'SELECT public.soc_full_sync_scheduled();');
SELECT cron.schedule('soc-sync-19h', '0 22 * * *', 'SELECT public.soc_full_sync_scheduled();');
SELECT cron.schedule('soc-sync-test-now', '* * * * *', 'SELECT public.soc_full_sync_scheduled();');
