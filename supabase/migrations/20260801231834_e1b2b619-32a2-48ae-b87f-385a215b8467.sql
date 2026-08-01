UPDATE contract_template_versions v
SET conteudo_html = replace(replace(replace(replace(replace(
  v.conteudo_html,
  '{{RAZAO_SOCIAL_CONTRATANTE}}', '{{RAZAO_SOCIAL}}'),
  '{{CNPJ_CONTRATANTE}}', '{{CNPJ}}'),
  '{{ENDERECO_CONTRATANTE}}', '{{ENDERECO}}'),
  '{{TELEFONE_CONTRATANTE}}', '{{TELEFONE}}'),
  '{{EMAIL_CONTRATANTE}}', '{{EMAIL}}')
FROM contract_templates t
WHERE t.current_version_id = v.id
  AND t.id IN (
    '86286e07-5616-469f-bbe1-bb8e9a147dbc',
    'be962ae9-40ac-4da0-b9ae-f727441ea638',
    '62346050-1897-4184-9f47-f1754587ad28',
    '9d58bc8b-a5a3-40e9-8f44-99082915c6f0'
  );