
ALTER TABLE public.passivos_parcelamentos
  ADD COLUMN IF NOT EXISTS pagamento_baixado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guia_recebida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guia_conferida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_segunda_via text,
  ADD COLUMN IF NOT EXISTS last_updated_by uuid,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.passivos_handle_operational_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto track who/when updated
  NEW.last_updated_by := auth.uid();
  NEW.last_updated_at := now();

  -- When pagamento_baixado transitions from false -> true, count the installment
  -- and reset the operational flags for the next cycle.
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.pagamento_baixado, false) = false
     AND COALESCE(NEW.pagamento_baixado, false) = true THEN
    IF NEW.parcelas_pagas < NEW.parcelas_totais THEN
      NEW.parcelas_pagas := NEW.parcelas_pagas + 1;
    END IF;
    IF NEW.parcelas_em_atraso > 0 THEN
      NEW.parcelas_em_atraso := NEW.parcelas_em_atraso - 1;
    END IF;
    -- close the cycle
    NEW.pagamento_baixado := false;
    NEW.guia_recebida := false;
    NEW.guia_conferida := false;

    -- auto-close when all installments are paid
    IF NEW.parcelas_pagas >= NEW.parcelas_totais THEN
      NEW.status := 'encerrado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_passivos_operational ON public.passivos_parcelamentos;
CREATE TRIGGER trg_passivos_operational
BEFORE INSERT OR UPDATE ON public.passivos_parcelamentos
FOR EACH ROW
EXECUTE FUNCTION public.passivos_handle_operational_update();
