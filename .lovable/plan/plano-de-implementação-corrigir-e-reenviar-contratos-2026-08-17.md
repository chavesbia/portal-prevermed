# Plano de Implementação - "Corrigir e Reenviar" (Contratos)

Este plano descreve a implementação da funcionalidade "Corrigir e Reenviar" no módulo de Gestão Contratual, permitindo que usuários corrijam termos de contratos já enviados/assinados através da criação assistida de uma versão substituta.

## Alterações Propostas

### 1. Lógica de Correção e Fluxo
- Criar `src/lib/contractual/correction.ts` para centralizar a lógica de:
  - Cancelar o contrato atual (status "cancelado").
  - Registrar evento de auditoria no contrato antigo.
  - Criar um novo rascunho (`draft`) copiando integralmente os dados do contrato anterior (empresa, testemunhas, itens, valores, vigência, etc.).
  - Registrar evento de substituição no novo contrato.

### 2. Interface de Detalhes do Contrato
- Modificar `src/pages/contratual/ContratualContratoDetalhe.tsx`:
  - Adicionar o botão "Corrigir e Reenviar" na barra de ações.
  - Gating de visibilidade: apenas para contratos com status `parcialmente_assinado` ou `assinado`.
  - Adicionar diálogo de confirmação explicando que o contrato atual será cancelado.

### 3. Integração com o Assistente (Wizard)
- Modificar `src/pages/contratual/ContratualContratoWizard.tsx`:
  - Adaptar o carregamento inicial para aceitar um `contrato_id` de origem para preenchimento automático.
  - Exibir um alerta visual persistente após a geração do PDF: "⚠️ Lembre-se de bloquear manualmente o documento antigo no painel do Autentique, para que ninguém assine a versão desatualizada."

### 4. Navegação
- Modificar `src/pages/contratual/ContratualContratos.tsx`:
  - Garantir que a navegação para o Wizard com o novo rascunho funcione corretamente após a ação de correção.

## Detalhes Técnicos
- **Segurança**: A operação de cancelamento e criação de rascunho respeitará as permissões de módulo existentes.
- **Rastreabilidade**: Os contratos serão vinculados via logs em `contract_eventos`, permitindo rastrear qual contrato substituiu qual.
- **Autentique**: Como o sistema não tem permissão para deletar documentos via API de forma arbitrária em fluxos de "Corrigir", o aviso manual é essencial para evitar assinaturas em versões obsoletas.

---
**Nota**: Não excluiremos registros. O histórico jurídico será preservado através do status "cancelado" no documento original.
