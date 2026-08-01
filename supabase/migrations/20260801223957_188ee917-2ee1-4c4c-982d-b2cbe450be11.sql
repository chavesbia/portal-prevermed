DELETE FROM public.responsaveis_tecnicos
WHERE id IN ('e561ac56-d6b2-4a5b-924e-1bd7dc2f5f49','8358178e-7838-4e48-a38d-54c3403b746b')
  AND profissional_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.laudos l WHERE l.responsavel_tecnico_id = public.responsaveis_tecnicos.id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_rt_conselho_registro_norm
  ON public.responsaveis_tecnicos (
    upper(btrim(conselho)),
    regexp_replace(regexp_replace(numero_registro, '[^0-9A-Za-z]', '', 'g'), '^0+', '')
  )
  WHERE ativo = true;