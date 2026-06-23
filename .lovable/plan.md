
# Módulo Gestão Contratual

Implementação em **4 fases**. Confirmando o plano, eu já começo pela Fase 1 e sigo até o fim sem novas perguntas (peço o token da Autentique no momento de ativar a Fase 3).

---

## Estrutura geral

- **Rota raiz**: `/gestao-contratual` (registrada no menu lateral dinâmico via tabela `modules`).
- **Sub-rotas**:
  - `/gestao-contratual` — Dashboard
  - `/gestao-contratual/clientes` — Cadastro de clientes
  - `/gestao-contratual/contratos` — Lista + Novo Contrato + Detalhe
  - `/gestao-contratual/modelos` — Gestor de modelos e versões
  - `/gestao-contratual/assinaturas` — Painel de status Autentique
- **Permissões**: granulares por rota (`can_view / can_edit / can_approve`), exatamente como os outros módulos. Sem novas roles. O adm_master configura na tela de Permissões.
- **Padrão visual**: azul institucional PreverMed, ícones lucide, tabelas com cabeçalho sticky e drawer lateral para detalhes, datas em DD/MM/YYYY, nomes em "Title Case".

---

## Fase 1 — Banco de dados + Clientes

**Tabelas novas** (todas com RLS + GRANTs + audit em `audit_log`):

| Tabela | Função |
|---|---|
| `contract_clientes` | Cadastro independente (CNPJ único). Campos do prompt + `situacao_cadastral`, `cnae_principal`. |
| `contract_templates` | Modelo de contrato (nome, categoria, descrição, status, versão atual). |
| `contract_template_versions` | Conteúdo HTML imutável por versão (nunca sobrescreve — nova versão = nova linha). |
| `contract_contratos` | Contrato gerado (cliente_id, template_version_id congelado, todos os campos configuráveis, `data_inicio`, `data_fim` calculado, `status`, `pdf_url`, `autentique_document_id`). |
| `contract_assinaturas` | Linha por signatário (representante + 2 testemunhas), status individual, data/hora. |
| `contract_eventos` | Timeline imutável (criado, editado, gerado PDF, enviado p/ Autentique, assinado, vencendo, vencido). |

**Trigger de vigência**: função `contract_calc_status(data_inicio, vigencia_meses)` retorna `ativo / vencendo_60 / vencendo_30 / vencendo_15 / vencido / encerrado`. Usada em views.

**Edge function `cnpj-lookup`** — proxy para BrasilAPI (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`), evita CORS e permite cache.

**Tela Clientes**: lista + busca por CNPJ/razão social, drawer de detalhe, modal "+ Novo Cliente" (digitou CNPJ → chama edge function → preenche campos → completa email/telefone/representante → salva).

---

## Fase 2 — Modelos + Editor de cláusulas + Contrato

**Editor rich-text WYSIWYG** com **TipTap** (já React-friendly, leve):
- Toolbar: negrito, itálico, sublinhado, listas, títulos H1–H3, alinhamento, tabela simples.
- Botão **"Inserir placeholder"** com dropdown listando os 22 placeholders do prompt (`{{RAZAO_SOCIAL}}`, etc.).
- Placeholders renderizados como chips coloridos no editor, salvos como texto no HTML.

**Tela Modelos**: lista por categoria, ações Novo / Editar / Duplicar / Visualizar / Desativar / Histórico de versões. Editar gera **nova versão** automaticamente — contratos antigos continuam apontando para a versão antiga.

**Tela Novo Contrato** (wizard 3 passos):
1. Selecionar cliente (autocomplete) + modelo + versão (default: ativa).
2. Preencher todos os campos configuráveis + dados dos signatários.
3. **Preview do contrato renderizado** (HTML do template com placeholders substituídos) + botões "Voltar / Confirmar e gerar PDF".

**Geração de PDF**: edge function `contract-generate-pdf` usando **Puppeteer (Browserless)** ou — para simplicidade e zero-config — **html-to-pdf via `@react-pdf/renderer` no client + upload ao Storage**. Vou usar a abordagem client-side com `html2pdf.js` (rápida, sem custos extras, suficiente para contratos). Bucket privado `contract-pdfs`, RLS por contrato_id.

---

## Fase 3 — Autentique + Webhook

**Secret**: `AUTENTIQUE_API_TOKEN` (vou pedir via add_secret após você aprovar o plano).

**Edge functions**:
- `autentique-send` — recebe `contrato_id`, baixa PDF do Storage, chama `POST https://api.autentique.com.br/v2/graphql` criando o documento com os 3 signatários, salva `autentique_document_id` + status `enviado`.
- `autentique-webhook` (público, sem JWT) — recebe eventos da Autentique, atualiza `contract_assinaturas` e `contract_contratos.status` (rascunho → enviado → parcialmente_assinado → assinado / cancelado), grava em `contract_eventos`.

A URL do webhook é gerada e exibida na tela de configurações para você colar no painel da Autentique.

---

## Fase 4 — Vigência, alertas e dashboard

**Cron job (`pg_cron`)** diário 06:00 BRT:
- Recalcula `status` de todos contratos ativos.
- Cria notificações no `notifications` para responsáveis quando entrar em 60/30/15 dias e quando vencer.
- Grava evento em `contract_eventos`.

**Dashboard** (`/gestao-contratual`):
- Cards: Ativos, Aguardando assinatura, Vencendo 30d, Vencidos, **Valor mensal total contratado** (SUM).
- Tabela resumida com filtros (Ativo / Assinado / Pendente / Vencido / Encerrado).
- Gráfico mensal: contratos criados x encerrados.

**Auditoria**: todo INSERT/UPDATE relevante grava em `audit_log` (já existente) + `contract_eventos` para a timeline do contrato.

---

## Detalhes técnicos

- **Stack**: React + TipTap + react-hook-form + zod + tanstack-query (padrão do projeto).
- **Validações**: CNPJ com dígito verificador, CPF dos signatários idem, valores monetários com 2 casas.
- **PDF**: logo PreverMed no cabeçalho, rodapé com número da proposta + página X de Y.
- **Versionamento congelado**: `contract_contratos.template_version_id` referencia `contract_template_versions.id` — editar o modelo nunca altera contratos já gerados.
- **Permissões na UI**: hook `useModulePermissions('/gestao-contratual/...')` gateia botões; RLS gateia o banco.

---

## O que NÃO entra nesta entrega

- Geração de PDF server-side com renderização pixel-perfect tipo Word (uso html2pdf no client — fica ótimo, mas se você quiser PDF/A ou layout complexo de cláusulas posso trocar por Puppeteer/Browserless numa fase extra).
- Importação em massa de contratos existentes (posso adicionar depois se precisar).

---

**Confirma o plano para eu começar pela Fase 1 (migration + tela de Clientes + lookup BrasilAPI)?**
