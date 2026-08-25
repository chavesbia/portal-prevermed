ALTER TABLE public.contract_contratos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS numero_original text;

ALTER TABLE public.contract_contratos
  DROP CONSTRAINT IF EXISTS contract_contratos_origem_check;
ALTER TABLE public.contract_contratos
  ADD CONSTRAINT contract_contratos_origem_check CHECK (origem IN ('portal','legado'));

CREATE OR REPLACE FUNCTION public.contract_contratos_before_save()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE yr text := to_char(now(),'YYYY'); next_seq integer; pfx text;
BEGIN
  pfx := CASE WHEN NEW.origem = 'legado' THEN 'LEG' ELSE 'CTR' END;

  -- Contratos legados usam a data_fim informada manualmente
  IF NEW.origem <> 'legado' AND NEW.data_inicio IS NOT NULL AND NEW.vigencia_meses IS NOT NULL THEN
    NEW.data_fim := (NEW.data_inicio + (NEW.vigencia_meses || ' months')::interval)::date;
  END IF;

  IF TG_OP = 'INSERT' AND (NEW.numero_contrato IS NULL OR NEW.numero_contrato = '') THEN
    -- Consideramos apenas números sequenciais puros (sem sufixos de letra) para o cálculo do próximo
    SELECT COALESCE(MAX(CAST(split_part(numero_contrato,'-',3) AS integer)),0)+1
      INTO next_seq FROM public.contract_contratos
      WHERE numero_contrato LIKE pfx||'-'||yr||'-%'
      AND split_part(numero_contrato,'-',3) ~ '^[0-9]+$';

    NEW.numero_contrato := pfx||'-'||yr||'-'||lpad(next_seq::text,4,'0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;

CREATE POLICY "Acesso autenticado aos PDFs de contratos legados"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'contract-legados')
WITH CHECK (bucket_id = 'contract-legados');