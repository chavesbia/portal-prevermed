# Plano de Validação de E-mails Únicos para Assinantes

O objetivo é impedir que o mesmo e-mail seja utilizado para diferentes assinantes no mesmo contrato, evitando confusão de identidade no Autentique.

## Alterações Técnicas

### 1. Novo utilitário de validação
- Criar `src/lib/contractual/validation.ts` com a função `validateUniqueEmails` que compara os e-mails dos 4 papéis (Representante, Contratada, Testemunha 1 e 2).
- Mapear nomes de exibição (Contratante, Contratada, etc.) para os campos técnicos.

### 2. Assistente de Novo Contrato (`ContratualContratoWizard.tsx`)
- Implementar a validação no `step 2`.
- Atualizar `canGoStep3` para depender da ausência de e-mails duplicados.
- Exibir mensagem de erro clara abaixo da lista de assinantes quando houver duplicidade.

### 3. Diálogo de Edição de Assinante (`AssinanteEditDialog.tsx`)
- Adicionar validação antes de salvar a alteração.
- Verificar se o novo e-mail já está sendo usado por outro assinante no mesmo contrato.
- Impedir o salvamento se houver conflito.

### 4. Varredura de Segurança
- Realizar uma varredura final no banco de dados para listar todos os contratos ativos (parcialmente assinados ou assinados) que possuem e-mails duplicados entre signatários.

## Detalhes da Interface
- **Mensagem de Erro:** "O e-mail de [Papel A] e [Papel B] não pode ser o mesmo — cada assinante precisa de um e-mail próprio para o Autentique identificar corretamente quem assinou."
- **Bloqueio:** O botão "Avançar" (no wizard) e "Salvar" (no diálogo) ficará desabilitado enquanto o erro persistir.
