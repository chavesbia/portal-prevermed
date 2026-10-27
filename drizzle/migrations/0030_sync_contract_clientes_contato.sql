CREATE OR REPLACE FUNCTION public.sync_contract_clientes_contato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid := COALESCE(NEW.company_id, OLD.company_id); v_email text; v_tel text;
BEGIN
  SELECT NULLIF(btrim(email_1),''), NULLIF(btrim(telefone_1),'') INTO v_email, v_tel
  FROM public.company_contacts WHERE company_id = v_company
  ORDER BY CASE WHEN soc_contact_code ~ '^\d+$' THEN soc_contact_code::bigint END NULLS LAST, created_at, id
  LIMIT 1;
  UPDATE public.contract_clientes cc SET
    email = COALESCE(v_email, cc.email),
    telefone = COALESCE(v_tel, cc.telefone),
    updated_at = now()
  WHERE cc.company_id = v_company
    AND ((v_email IS NOT NULL AND cc.email IS DISTINCT FROM v_email) OR (v_tel IS NOT NULL AND cc.telefone IS DISTINCT FROM v_tel));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_contract_clientes_contato ON public.company_contacts;
CREATE TRIGGER trg_sync_contract_clientes_contato
AFTER INSERT OR UPDATE OF email_1, telefone_1, soc_contact_code OR DELETE
ON public.company_contacts FOR EACH ROW EXECUTE FUNCTION public.sync_contract_clientes_contato();

-- backfill
UPDATE public.company_contacts SET email_1 = email_1 WHERE company_id IN (SELECT company_id FROM public.contract_clientes WHERE company_id IS NOT NULL);