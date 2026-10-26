CREATE OR REPLACE FUNCTION public.sync_contract_clientes_from_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.contract_clientes cc SET
    razao_social = COALESCE(NULLIF(NEW.razao_social,''), cc.razao_social),
    cep = COALESCE(NULLIF(NEW.cep,''), cc.cep),
    logradouro = COALESCE(NULLIF(NEW.logradouro,''), cc.logradouro),
    numero = COALESCE(NULLIF(NEW.numero,''), cc.numero),
    complemento = NEW.complemento,
    bairro = COALESCE(NULLIF(NEW.bairro,''), cc.bairro),
    cidade = COALESCE(NULLIF(NEW.cidade,''), cc.cidade),
    estado = COALESCE(NULLIF(NEW.estado,''), cc.estado),
    updated_at = now()
  WHERE (cc.company_id = NEW.id OR regexp_replace(cc.cnpj,'\D','','g') = regexp_replace(COALESCE(NEW.cnpj,''),'\D','','g'))
    AND (cc.razao_social IS DISTINCT FROM NEW.razao_social OR cc.cep IS DISTINCT FROM NEW.cep
      OR cc.logradouro IS DISTINCT FROM NEW.logradouro OR cc.numero IS DISTINCT FROM NEW.numero
      OR cc.complemento IS DISTINCT FROM NEW.complemento OR cc.bairro IS DISTINCT FROM NEW.bairro
      OR cc.cidade IS DISTINCT FROM NEW.cidade OR cc.estado IS DISTINCT FROM NEW.estado);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_contract_clientes ON public.companies;
CREATE TRIGGER trg_sync_contract_clientes
AFTER INSERT OR UPDATE OF razao_social, cep, logradouro, numero, complemento, bairro, cidade, estado, cnpj
ON public.companies FOR EACH ROW EXECUTE FUNCTION public.sync_contract_clientes_from_company();

-- backfill: alinhar cadastros contratuais existentes com a base SOC
UPDATE public.companies SET cep = cep WHERE id IN (SELECT company_id FROM public.contract_clientes WHERE company_id IS NOT NULL);