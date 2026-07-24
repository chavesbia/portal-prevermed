ALTER TABLE public.companies_sync_log
  ADD COLUMN IF NOT EXISTS raw_samples jsonb,
  ADD COLUMN IF NOT EXISTS all_field_names jsonb;