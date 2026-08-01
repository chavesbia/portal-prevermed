WITH primeiro_contato AS (
  SELECT DISTINCT ON (company_id) company_id, telefone_1, email_1
  FROM public.company_contacts
  ORDER BY company_id, created_at ASC, id ASC
)
UPDATE public.contract_clientes cc
SET
  cep = COALESCE(NULLIF(btrim(cc.cep), ''), c.cep),
  logradouro = COALESCE(NULLIF(btrim(cc.logradouro), ''), c.logradouro),
  numero = COALESCE(NULLIF(btrim(cc.numero), ''), c.numero),
  complemento = COALESCE(NULLIF(btrim(cc.complemento), ''), c.complemento),
  bairro = COALESCE(NULLIF(btrim(cc.bairro), ''), c.bairro),
  cidade = COALESCE(NULLIF(btrim(cc.cidade), ''), c.cidade),
  estado = COALESCE(NULLIF(btrim(cc.estado), ''), c.estado),
  telefone = COALESCE(NULLIF(btrim(cc.telefone), ''), NULLIF(btrim(pc.telefone_1), '')),
  email = COALESCE(NULLIF(btrim(cc.email), ''), NULLIF(btrim(pc.email_1), '')),
  updated_at = now()
FROM public.companies c
LEFT JOIN primeiro_contato pc ON pc.company_id = c.id
WHERE cc.company_id = c.id
  AND (
    NULLIF(btrim(cc.logradouro), '') IS NULL OR
    NULLIF(btrim(cc.numero), '') IS NULL OR
    NULLIF(btrim(cc.bairro), '') IS NULL OR
    NULLIF(btrim(cc.cidade), '') IS NULL OR
    NULLIF(btrim(cc.estado), '') IS NULL OR
    NULLIF(btrim(cc.cep), '') IS NULL OR
    NULLIF(btrim(cc.telefone), '') IS NULL OR
    NULLIF(btrim(cc.email), '') IS NULL
  );