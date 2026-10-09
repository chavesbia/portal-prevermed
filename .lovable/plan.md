# Plano: Módulo Agenda (configurações + operação)

## Visão geral

```text
Menu Administração → "Agenda" (substitui "SOC Agenda")
  Unidades e calendário | Bloqueios | Regras de exames | Limites diários | Documentos exigidos | Integração SOC

Meus Módulos → "Agendamentos"
  Listagem | Aprovação de Retorno ao Trabalho | Dashboard

Página pública /agendamento
  passa a respeitar todas as regras acima + "Completar pré-agendamento" (kit posterior)
```

## Fase 1 — Configurações (Administração → Agenda)

1. **Unidades e calendário**: por unidade (Lapa, Osasco), dias da semana atendidos e horário de início e fim de cada dia.
2. **Bloqueios**: feriados (aproveita a lista de feriados do portal), datas fechadas, encerramento antecipado (ex.: 24/12 até 12h). Por unidade ou todas.
3. **Regras de exames**: cadastro de exames especiais (Audiometria, Avaliação Psicológica, Psicossocial, Teste Oftalmológico, Ergométrico e novos), com dias da semana, faixa de horário e antecedência mínima em dias, por unidade. Indica se é feito em parceiro.
4. **Limites diários**: quantidade máxima por tipo de exame (ex.: Retorno ao Trabalho), por unidade e dia da semana.
5. **Documentos exigidos por tipo de exame**: lista configurável. Começa com Retorno ao Trabalho (Comunicado INSS, Alta Médica, Laudo do Especialista, Outros).
6. **Integração SOC**: o que hoje está em SOC Agenda (códigos das agendas), sem mudança.

## Fase 2 — Agendamento público com regras

- **Vagas reais**: se o SOC tiver 2 ou mais vagas no mesmo horário, o horário aparece com a quantidade ("3 vagas") e só some quando todas forem ocupadas.
- **Bloqueio com solução**: horários fora do calendário, bloqueados ou acima do limite não aparecem. Se um exame selecionado não atende o dia ou horário, aparece uma explicação e uma sugestão ("Ergométrico só às terças e quintas, com 3 dias de antecedência. Próximas datas: 14/10, 16/10" + botão para escolher). Outra opção: remover o exame e agendar em separado.
- **Retorno ao Trabalho**: motivo do retorno obrigatório + anexos obrigatórios conforme a configuração. Não grava no SOC na hora: fica "Aguardando aprovação da documentação". Depois da aprovação, o portal grava no SOC (se a vaga ainda existir; senão, avisa para escolher outro horário).
- **Kit posterior**: o comprovante traz um link "Completar pré-agendamento". O parceiro informa protocolo + CPF e envia guia, ficha clínica e ASO.
- Todas as regras são conferidas também na gravação final, não só na tela.

## Fase 3 — Meus Módulos → Agendamentos

- **Listagem** por dia, período e unidade, lembrando a última unidade e data escolhidas. Mostra colaborador, empresa, tipo, exames, kit/anexos (abrir arquivo), observações, status no SOC.
- **Aprovação de documentação (Retorno ao Trabalho)**: fila para a equipe de saúde. Aprovar (grava no SOC) ou devolver com motivo (ex.: "laudo ilegível"). Depois de corrigido, volta para a fila. Tudo registrado na auditoria.
- **Dashboard**: quantidade de exames por dia e por unidade, colaboradores agendados, quantidade por tipo de ficha (geral e por unidade).

## Fora deste plano (próxima etapa)

- Envio automático dos anexos para o SOCGED do funcionário.
- Aviso por e-mail ou WhatsApp ao parceiro quando a documentação for devolvida.

## Detalhes técnicos

- Novas tabelas: `agenda_calendario` (unidade, dia da semana, início, fim), `agenda_bloqueios` (unidade nula = todas, data, hora_fim_antecipada nula = dia inteiro), `agenda_exames_regras` (nome do exame do catálogo, unidade, dias, faixa de horário, antecedência, parceiro), `agenda_limites` (unidade, tipo de exame, dia da semana, máximo), `agenda_documentos_exigidos` (tipo de exame, nome do documento, obrigatório). Leitura e escrita só para adm_master; leitura pública só via funções.
- `soc_agendamentos` ganha: `motivo_retorno`, `aprovacao_status` (pendente/aprovado/devolvido), `aprovado_por`, `aprovado_em`, `devolucao_motivo`. Nova tabela `soc_agendamento_anexos` (tipo de documento, caminho no armazenamento privado, enviado_em).
- `soc-agenda-horarios`: passa a contar as vagas por horário (sem deduplicar), descontar agendamentos já feitos e aplicar calendário, bloqueios e limites. Devolve o motivo e as próximas datas válidas quando bloqueia.
- `soc-agenda-solicitar`: valida as mesmas regras no servidor; no Retorno ao Trabalho salva sem gravar no SOC. Nova ação `aprovar` (somente usuários com permissão no módulo Agendamentos) que grava no SOC. Nova função pública `soc-agenda-kit` (protocolo + CPF) para enviar anexos depois.
- Rotas: `/admin/agenda` (substitui `/admin/soc-agenda`, que redireciona) e `/agendamentos` (módulo com permissão granular, cadastrado em módulos). Filtros e abas nos parâmetros da URL; última unidade guardada no navegador.
