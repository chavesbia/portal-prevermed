# Plano de Implementação: Rescisão Contratual

Implementação do módulo de Rescisão Contratual para registro formal de cancelamentos de contratos (Portal ou legados).

## Alterações Realizadas
- [x] Criada tabela `contract_rescisoes` com enums de motivos e status.
- [x] Criado bucket privado `contract-rescisoes` para armazenamento de cartas de solicitação.
- [x] Implementada trigger para automação: preencher `data_real_inativacao` altera status do contrato para `encerrado` e da rescisão para `confirmada`.

## Próximos Passos

### 1. Novo Componente: `ContratualRescisaoDialog.tsx`
- Diálogo reutilizável para registrar a rescisão.
- Seleção de empresa via `CompanySelector`.
- Seleção de contrato existente da empresa ou opção "Contrato não está no sistema" (preenchimento manual).
- Upload de anexo para o bucket `contract-rescisoes`.
- Campos financeiros (últimos 3 faturamentos) e detalhes do solicitante.

### 2. Integração na Lista de Contratos (`ContratualContratos.tsx`)
- Adicionar botão global "Registrar Rescisão" no cabeçalho.
- Abrir o diálogo vazio para seleção manual.

### 3. Integração no Detalhe do Contrato (`ContratualContratoDetalhe.tsx`)
- Adicionar botão "Rescindir este Contrato" nas ações do contrato.
- Abrir o diálogo já pré-preenchido com a empresa e o contrato atual.

## Detalhes Técnicos
- **Trigger**: `trg_contract_rescisao_confirmar` garante a integridade entre a rescisão e o status do contrato.
- **Segurança**: RLS configurado para acesso apenas a usuários autenticados; bucket privado.
- **UX**: Máscaras de entrada para WhatsApp e e-mail; validação de campos obrigatórios.
