CREATE OR REPLACE FUNCTION public.contract_contratos_before_save()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE yr text := to_char(now(),'YYYY'); next_seq integer;
BEGIN
  IF NEW.data_inicio IS NOT NULL AND NEW.vigencia_meses IS NOT NULL THEN
    NEW.data_fim := (NEW.data_inicio + (NEW.vigencia_meses || ' months')::interval)::date;
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.numero_contrato IS NULL OR NEW.numero_contrato = '') THEN
    -- Consideramos apenas números sequenciais puros (sem sufixos de letra) para o cálculo do próximo
    SELECT COALESCE(MAX(CAST(split_part(numero_contrato,'-',3) AS integer)),0)+1
      INTO next_seq FROM public.contract_contratos
      WHERE numero_contrato LIKE 'CTR-'||yr||'-%'
      AND split_part(numero_contrato,'-',3) ~ '^[0-9]+$';
      
    NEW.numero_contrato := 'CTR-'||yr||'-'||lpad(next_seq::text,4,'0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;