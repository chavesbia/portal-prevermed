ALTER TYPE public.contract_signer_status ADD VALUE IF NOT EXISTS 'falha_envio';
ALTER TABLE public.contract_assinaturas ADD COLUMN IF NOT EXISTS erro_detalhe text;

-- Ensure authenticated role can see/update these (though RLS handles it, good to check GRANTS if new columns added)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_assinaturas TO authenticated;
GRANT ALL ON public.contract_assinaturas TO service_role;
