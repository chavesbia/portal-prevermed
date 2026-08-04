
-- Invertendo TESTEMUNHA_1 e TESTEMUNHA_2 em todos os templates ativos
UPDATE public.contract_template_versions
SET conteudo_html = REPLACE(
    REPLACE(
        REPLACE(conteudo_html, '{{TESTEMUNHA_1}}', '[[TEMP_T1]]'),
        '{{TESTEMUNHA_2}}', '{{TESTEMUNHA_1}}'
    ),
    '[[TEMP_T1]]', '{{TESTEMUNHA_2}}'
)
WHERE id IN (
    SELECT current_version_id FROM public.contract_templates WHERE ativo = true
);

-- O mesmo para os CPFs correspondentes
UPDATE public.contract_template_versions
SET conteudo_html = REPLACE(
    REPLACE(
        REPLACE(conteudo_html, '{{CPF_TESTEMUNHA_1}}', '[[TEMP_CPF1]]'),
        '{{CPF_TESTEMUNHA_2}}', '{{CPF_TESTEMUNHA_1}}'
    ),
    '[[TEMP_CPF1]]', '{{CPF_TESTEMUNHA_2}}'
)
WHERE id IN (
    SELECT current_version_id FROM public.contract_templates WHERE ativo = true
);
