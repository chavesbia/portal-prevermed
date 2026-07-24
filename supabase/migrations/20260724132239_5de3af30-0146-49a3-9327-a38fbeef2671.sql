ALTER TABLE public.companies_sync_log 
  ADD COLUMN IF NOT EXISTS skipped jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0;