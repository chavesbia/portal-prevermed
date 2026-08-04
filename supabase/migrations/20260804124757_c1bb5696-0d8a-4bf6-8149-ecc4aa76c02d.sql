
-- Identificado que no template 'Gestão Ocupacional - Padrão', TESTEMUNHA_1 (Contratada) estava vindo DEPOIS de TESTEMUNHA_2 (Contratante)
-- O sistema mapeia TESTEMUNHA_1 -> Contratada e TESTEMUNHA_2 -> Contratante.
-- Como já rodei um swap global, os outros templates que usavam 1 e 2 em lista (1, 2) agora estão (2, 1), o que é CORRETO se 1=Contratada e 2=Contratante.
-- Vou verificar o Padrão especificamente para garantir que ele segue a mesma lógica.
UPDATE public.contract_template_versions
SET conteudo_html = REPLACE(
    REPLACE(
        REPLACE(conteudo_html, '{{TESTEMUNHA_1}}', '[[TEMP_T1]]'),
        '{{TESTEMUNHA_2}}', '{{TESTEMUNHA_1}}'
    ),
    '[[TEMP_T1]]', '{{TESTEMUNHA_2}}'
)
WHERE id = '4856376a-ebf8-4359-8f2b-0055a0c023a2';

UPDATE public.contract_template_versions
SET conteudo_html = REPLACE(
    REPLACE(
        REPLACE(conteudo_html, '{{CPF_TESTEMUNHA_1}}', '[[TEMP_CPF1]]'),
        '{{CPF_TESTEMUNHA_2}}', '{{CPF_TESTEMUNHA_1}}'
    ),
    '[[TEMP_CPF1]]', '{{CPF_TESTEMUNHA_2}}'
)
WHERE id = '4856376a-ebf8-4359-8f2b-0055a0c023a2';
