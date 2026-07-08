# Roadmap – Módulo Gestão de OS

Plano dividido em fases entregáveis. Cada fase é independente e pode ser aprovada/implementada isoladamente. As primeiras corrigem o que já regrediu vs. o projeto original; as últimas ampliam para gestão financeira e inteligência de dados.

---

## Fase 1 — Correções de paridade com o projeto original (rápida)

Objetivo: recolocar o módulo no mesmo patamar funcional do projeto de referência.

- **Ações da OS**: adicionar de volta "Agendar Visita" no menu (dropdown da lista), reabrindo o `OSVisitaDialog` existente.
- **Histórico visual**: restaurar o layout de timeline vertical do `OSHistoryDialog` (ícones por tipo de ação, cor por status, agrupamento por dia) — hoje está como lista simples.
- **Responsável Técnico**: incluir **MTE** entre os conselhos e permitir cadastrar novos conselhos de classe pelo próprio select ("+ Novo conselho"), gravando em tabela `conselhos_classe`.
- **Emissor da OS**: exibir "Criado por" (já temos `created_by`) no cabeçalho do detalhe e na listagem (coluna opcional).

Entrega: só frontend + 1 migração pequena (tabela `conselhos_classe`).

---

## Fase 2 — Novo modelo de Status e SLA

Objetivo: separar SLA da OS do status operacional dos serviços.

- **Status da OS** (macro, dispara SLA): `Não iniciado`, `Em andamento`, `Encerrado`.
- **Status do Serviço** (operacional): `Não iniciado`, `Em andamento`, `Agendado`, `Em revisão interna`, `Aguardando cliente`, `Encerrado`.
- **Regra de transição automática da OS**:
  - todos os serviços `Não iniciado` → OS `Não iniciado`
  - qualquer serviço em progresso → OS `Em andamento`
  - todos `Encerrado` → OS `Encerrado` (congela SLA)
- **SLA da OS**: calculado a partir de `data_registro` vs `prazo_acordado` em dias úteis, com faixas Em dia / Atenção (≤3 dias) / Atrasado / Encerrado. Congela na data de encerramento.
- Migração de dados: mapear status antigos para os novos.
- Atualizar filtros, KPIs do dashboard e badges de cor.

Entrega: migração de enums + trigger de propagação + ajustes de UI (Lista, Filtros, Dashboard, SLA View).

---

## Fase 3 — Emissor + Responsável por Serviço

Objetivo: rastreabilidade de quem abre a OS (comercial) e quem executa cada serviço (interno ou externo).

- **Nova tabela `profissionais`**: `tipo` (interno/externo), `nome`, `categoria` (médico, psicólogo, enfermeiro, eng. segurança, técnico seg., outros), `conselho_id`, `numero_conselho`, `custo_padrao`, `user_id` (opcional, se interno).
- **`servicos_os.responsavel_id`** → FK para `profissionais`.
- UI:
  - No cadastro/edição de OS, para cada serviço: select "Responsável" com busca (internos e externos) + botão "+ Novo profissional".
  - Cabeçalho da OS mostra "Emissor" (nome do `created_by`, com badge "Comercial" quando o setor bate).
  - Página `/gestao-os/profissionais` (CRUD simples, restrito por permissão).
- Histórico registra troca de responsável por serviço.

Entrega: 2 migrações + tela de profissionais + ajustes nos dialogs de OS.

---

## Fase 4 — Base de Custos (schema pronto, UI mínima)

Objetivo: preparar o terreno para gestão financeira sem já expor tudo ao usuário.

- **Novas tabelas**:
  - `os_custos` — custos vinculados à OS ou ao serviço (`ordem_id`, `servico_os_id` nullable, `tipo`, `descricao`, `valor`, `data`, `fornecedor`, `anexo_url`).
  - `custo_tipos` enum: `profissional_externo`, `art`, `deslocamento`, `locacao_equipamento`, `hospedagem`, `alimentacao`, `outros`.
  - `os_custos_padrao` (opcional) — valores default por tipo de serviço/profissional.
- UI mínima nesta fase: aba "Custos" no detalhe da OS listando/adicionando lançamentos manuais.
- Preparação para importação de ART e integração futura com contas a pagar.

Entrega: migrações + aba nova no `OSDetailDialog`.

---

## Fase 5 — Gestão Financeira da OS

Objetivo: consolidar custos, receita e margem por OS/serviço.

- Vincular OS a **contrato/proposta** (usar `commercial_contracts` ou `quotations` como origem de receita).
- Campos calculados: receita total, custo total (soma de `os_custos`), margem R$ e %.
- Alertas: OS com margem negativa, custo estourando orçamento, ART vencendo.
- Relatório mensal por cliente / por responsável técnico / por tipo de serviço.
- Exportação CSV/PDF.

Entrega: views/materialized views + página de indicadores financeiros.

---

## Fase 6 — Inteligência e Automação

Objetivo: reduzir trabalho manual e antecipar problemas.

- **Notificações**: SLA em atenção/atrasado, serviço parado há X dias em "Aguardando cliente", ART próxima do vencimento.
- **Agenda unificada** (`OSAgendaView` + visitas + prazos) com sincronização iCal.
- **Dashboards executivos**: heatmap de carga por responsável, produtividade por profissional, ticket médio, comparativo mês a mês.
- **Anexos**: padronizar bucket privado para documentos da OS (contrato, ART, laudo final) com URLs assinadas.
- **API/Webhook** para integração futura com ERP financeiro.

Entrega: edge functions de notificação + dashboards + storage bucket.

---

## Sequência sugerida de execução

```text
Fase 1  →  Fase 2  →  Fase 3  →  Fase 4  →  Fase 5  →  Fase 6
 (dias)   (dias)     (semana)   (dias)     (semana)   (contínuo)
```

Fases 1–3 resolvem tudo o que você citou hoje. Fases 4–6 são a evolução natural para o que você já sinalizou como próximo passo (custos, ART, deslocamento, profissional externo).

## Detalhes técnicos

- Novas tabelas usam RLS com `is_adm_master()` + `can_edit_module_route('/gestao-os')`, seguindo o padrão do projeto.
- Enums em migração separada com backfill via `UPDATE` mapeando os status antigos.
- Trigger `propagar_status_os()` recalcula `ordens_servico.status_os` sempre que `servicos_os` muda.
- `profissionais.user_id` referencia `auth.users` para internos; externos ficam com `user_id NULL`.
- `os_custos` já nasce com `created_by`, `created_at`, `updated_at` e histórico via `historico_os`.
- Nenhuma alteração nos módulos ASO, Guias ou Comercial nesta trilha.

Qual fase você quer que eu comece a executar?
