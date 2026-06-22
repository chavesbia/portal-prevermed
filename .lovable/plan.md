# Módulo de Gestão de Feedback

Novo módulo `/gestao-feedback` integrado ao portal, com perfis RH e Gestor, dashboards executivos, formulário oficial de feedback, PDI, feedforward, matriz de risco e alertas. Substitui os controles atuais em Word/Excel.

## Escopo desta entrega (Fase 1)

Inclui tudo do brief, exceto:
- **Visão Colaborador** (marcada como "fase futura" no próprio brief).
- **Notificações por e-mail externo**: alertas serão exibidos via sistema de notificações interno já existente (sino + banner), com agendamento via pg_cron. E-mail externo pode ser adicionado depois.
- **Exportação PDF/Excel**: incluída, mas o PDF será uma versão imprimível otimizada (window.print com layout dedicado), não geração server-side.

## Estrutura do módulo

```
/gestao-feedback
├── Dashboard         → KPIs corporativos / do gestor (conforme perfil)
├── Colaboradores     → Lista filtrável + status de feedback (substitui planilha)
├── Feedbacks         → Lista de avaliações realizadas + nova avaliação
├── Planos de Ação    → PDI + Feedforward consolidados
├── Histórico         → Linha do tempo por colaborador (drawer)
├── Indicadores       → Radar, mapa de calor, ranking, evolução
└── Configurações     → (RH) competências, descrições oficiais, periodicidade, setores
```

## Perfis e permissões

Usa o sistema RBAC existente (`get_user_accessible_modules`, `can_edit_module_route`, etc.). Rotas registradas:

| Rota | RH/ADM | Gestor |
|------|:------:|:------:|
| `/gestao-feedback` | ver | ver |
| `/gestao-feedback/colaboradores` | ver/editar | ver (escopo equipe) |
| `/gestao-feedback/feedbacks` | ver/editar | ver/criar/editar (equipe) |
| `/gestao-feedback/planos-acao` | ver/editar | ver/editar (equipe) |
| `/gestao-feedback/indicadores` | ver | ver (equipe) |
| `/gestao-feedback/configuracoes` | ver/editar | — |

Escopo "equipe do gestor" via função `is_gestor_de(_user_id, _colaborador_id)` baseada em `colaboradores.gestor_id`.

## Modelo de dados (Lovable Cloud / Postgres)

```text
fb_setores(id, nome, ativo)
fb_colaboradores(id, user_id?, nome, matricula, cpf, cargo, setor_id, gestor_id→profiles, data_admissao, status, periodicidade_dias)
fb_competencias(id, ordem, nome, ativo)                       -- 10 fatores oficiais
fb_competencia_niveis(id, competencia_id, nota 1..4, descricao_oficial)  -- texto exato PreverMed
fb_avaliacoes(id, colaborador_id, gestor_id, data_avaliacao, data_proximo_feedback,
              atividades, pontos_positivos, pontos_melhora, acoes_melhoria, observacoes,
              pontuacao_total, classificacao, criada_em, atualizada_em)
fb_avaliacao_notas(id, avaliacao_id, competencia_id, nota 1..4, comentario)
fb_feedforward(id, avaliacao_id, acao, responsavel, prazo, status)        -- não_iniciado/em_andamento/concluido
fb_pdi(id, avaliacao_id, competencia_id, acao, responsavel, prazo, evidencia, status)
fb_config(id singleton, periodicidade_padrao_dias, alertas_dias int[])
fb_audit(id, entidade, entidade_id, acao, user_id, payload, created_at)
```

Triggers:
- `fb_avaliacoes`: recalcula `pontuacao_total` (soma de `fb_avaliacao_notas`) e `classificacao` (faixas oficiais) antes de salvar.
- Validação: exige 10 notas (uma por competência ativa) ao concluir.
- `fb_audit`: log imutável de inserts/updates relevantes.

Views:
- `fb_v_status_colaborador`: por colaborador devolve último feedback, próximo feedback, status (🟢🟡🔴), pontuação, classificação, nível de risco.
- `fb_v_indicadores_empresa`: distribuição, ranking setor/gestor, médias por competência.

RLS:
- RH (`adm_master` / `can_edit /gestao-feedback/configuracoes`): acesso total.
- Gestor: SELECT/INSERT/UPDATE apenas quando `is_gestor_de(auth.uid(), colaborador_id)`.
- Descrições oficiais: SELECT para autenticados, UPDATE só RH.

Grants: `SELECT/INSERT/UPDATE/DELETE TO authenticated` + `ALL TO service_role` em todas as tabelas `fb_*`.

## Cálculo e classificação

```
pontuacao = soma(notas)   ∈ [10..40]
10–18 → INSUFICIENTE  (vermelho)
19–23 → FRACO          (laranja)
24–28 → RAZOÁVEL       (amarelo)
29–34 → BOM            (azul)
35–40 → EXCELENTE      (verde)
```

Risco (view derivada):
- ALTO: pontuação < 24 **ou** >3 competências com nota 1 **ou** queda em 2 avaliações consecutivas
- MÉDIO: 24–28
- BAIXO: ≥29

## Formulário de feedback (UX)

Drawer multi-step:
1. **Cabeçalho** — colaborador, setor, gestor, data, data próximo feedback.
2. **Avaliação por competências** — para cada uma das 10:
   - Seletor de nota 1–4
   - Painel lateral mostra automaticamente a **Descrição Oficial** cadastrada (texto fixo, não editável).
3. **Campos qualitativos** — atividades, pontos positivos/melhora, ações, observações. Botão "✨ Assistente de redação" chama Lovable AI Gateway (`google/gemini-3-flash-preview`) apenas para sugerir texto; jamais altera notas nem descrições.
4. **Feedforward** — combinados próximo ciclo (linhas: ação, responsável, prazo, status).
5. **PDI** — automaticamente sugere linha para cada competência com nota ≤2.
6. **Resumo** — velocímetro Recharts, pontuação total, classificação, botão Concluir.

## Dashboards

- **Principal (RH)**: cards (total, pendentes, do mês, vencidos, próximos vencer, média geral, em risco) + distribuição de classificação (donut) + ranking setores/gestores + evolução mensal/trimestral/anual (line).
- **Gestor**: cards da equipe + lista de pendentes/vencidos + planos pendentes + evolução da equipe.
- **Indicadores**: radar (atual × anterior por colaborador), mapa de calor competências × setor com destaque <2.5, matriz de risco.

## Alertas

`pg_cron` diário às 06:00 (insert tool, não migration):
- Para cada colaborador, calcula dias até `data_proximo_feedback`.
- Em 30/15/7 dias e quando vencido → cria `notifications` para o gestor.
- Planos vencidos e colaboradores ALTO RISCO → notificação adicional ao gestor + RH.

## Configurações (RH)

Tela com abas:
- **Competências e Níveis** — CRUD das 10 competências e 4 descrições oficiais cada (40 linhas). Importação inicial via seed SQL com placeholders `[INSERIR DESCRIÇÃO OFICIAL]` — RH preenche os textos exatos do documento. **Nenhuma descrição é gerada por IA.**
- **Setores** — CRUD.
- **Colaboradores** — CRUD + vínculo com gestor (usuário do portal).
- **Periodicidade** — dias padrão entre feedbacks + janelas de alerta.

## Tecnologia

- React + TypeScript + Tailwind + shadcn (já no projeto).
- Recharts para gráficos.
- Lovable Cloud (Supabase) com RLS.
- Lovable AI Gateway para assistente de redação (opt-in, somente campos qualitativos).
- Realtime sync nos dashboards via canal Supabase.

## Plano de implementação (ordem)

1. **Migration**: enums, tabelas `fb_*`, views, triggers, RLS, grants, função `is_gestor_de`. Seed das 10 competências com 4 níveis (descrições em branco para RH preencher).
2. **Registro do módulo** em `modules` + rotas em `App.tsx` + sidebar.
3. **Hooks**: `useFeedbackData`, `useFeedbackPermissions`, `useColaboradores`, `useAvaliacoes`.
4. **Páginas**: Dashboard, Colaboradores, Feedbacks (listagem), Indicadores, Configurações.
5. **Drawer de avaliação** (multi-step) + velocímetro.
6. **PDI/Feedforward** consolidados.
7. **Histórico** (drawer linha do tempo).
8. **Cron de alertas** + integração com `notifications`.
9. **Exportação**: print-friendly PDF + Excel via SheetJS (já no projeto).
10. **Auditoria** + smoke test.

## Confirmações antes de começar

1. **Descrições oficiais**: você fornecerá o documento PreverMed com os 40 textos (10 competências × 4 níveis) para eu cadastrar via seed, ou prefere que eu deixe os campos vazios na config para o RH preencher pela tela? *(Recomendo a segunda opção para garantir fidelidade ao documento.)*
2. **Cadastro de colaboradores**: vinculo opcional ao `profiles` (usuário do portal) ou são cadastros 100% independentes? *(Recomendo opcional — habilita fase futura do colaborador sem retrabalho.)*
3. **Gestor**: é sempre um usuário do portal (perfil existente) ou pode ser texto livre? *(Recomendo usuário do portal — necessário para RLS e alertas.)*

Posso seguir já assumindo as recomendações acima se você preferir não responder agora.