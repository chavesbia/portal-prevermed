UPDATE contract_template_versions v
SET conteudo_html = replace(replace(
  v.conteudo_html,
  '{{QUANTIDADE_VIDAS_EXTENSO}}', '{{QTD_VIDAS_EXTENSO}}'),
  '{{QUANTIDADE_VIDAS}}', '{{QTD_VIDAS}}')
FROM contract_templates t
WHERE t.current_version_id = v.id
  AND t.id IN (
    'be962ae9-40ac-4da0-b9ae-f727441ea638',
    '9d58bc8b-a5a3-40e9-8f44-99082915c6f0'
  );