BEGIN;

-- Investigação Campinas (CTR-2026-0045 e CTR-2026-0046)
SELECT 
    c.numero_contrato,
    c.created_at,
    p.full_name as criado_por,
    a.nome as assinante,
    a.email as assinante_email,
    a.status as status_assinatura,
    a.erro_detalhe
FROM 
    public.contract_contratos c
LEFT JOIN 
    public.profiles p ON p.user_id = c.created_by
LEFT JOIN 
    public.contract_assinaturas a ON a.contrato_id = c.id
WHERE 
    c.numero_contrato IN ('CTR-2026-0045', 'CTR-2026-0046')
ORDER BY 
    c.created_at, a.nome;

-- Deleção dos rascunhos confirmados (Categoria 1 + Rascunho Campinas)
DELETE FROM public.contract_contratos 
WHERE numero_contrato IN (
    'CTR-2026-0030', 
    'CTR-2026-0015', 
    'CTR-2026-0017', 
    'CTR-2026-0018', 
    'CTR-2026-0022', 
    'CTR-2026-0023',
    'CTR-2026-0025'
)
AND html_final IS NULL 
AND NOT EXISTS (
    SELECT 1 FROM public.contract_assinaturas 
    WHERE contrato_id = public.contract_contratos.id
);

COMMIT;