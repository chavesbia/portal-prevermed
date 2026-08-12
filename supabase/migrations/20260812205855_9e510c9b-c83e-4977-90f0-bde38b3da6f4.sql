DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelado' AND enumtypid = 'contract_status'::regtype) THEN
        ALTER TYPE public.contract_status ADD VALUE 'cancelado';
    END IF;
END
$$;

UPDATE public.contract_contratos 
SET status = 'cancelado', updated_at = now() 
WHERE numero_contrato = 'CTR-2026-0046';

INSERT INTO public.contract_eventos (contrato_id, tipo, descricao, detalhes)
SELECT id, 'auditoria', 'Cancelado por duplicidade — ver CTR-2026-0045 como documento válido para esta proposta.', 
jsonb_build_object('motivo', 'duplicidade', 'valido', 'CTR-2026-0045')
FROM public.contract_contratos WHERE numero_contrato = 'CTR-2026-0046';