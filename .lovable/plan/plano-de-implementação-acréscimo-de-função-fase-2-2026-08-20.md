### Plano de Implementação: Acréscimo de Função (Fase 2)

#### 1. Diagnóstico de Sincronização de Preço
- Investigar por que o valor não calculou para a empresa **Prever Centro Médico (SOC 698370)**.
- Verificar a tabela `company_pricing_items` para confirmar a presença do código `000000062`.
- Analisar os logs de execução do Edge Function `soc-preco-sync` para garantir que o processamento ocorreu sem falhas.

#### 2. Refatoração da Tela de Acréscimo de Função (`OSAcrescimoFuncaoView.tsx`)
- **Correção de Layout**: Garantir que o container use `w-full overflow-x-auto` e a tabela tenha rolagem interna adequada para evitar cortes em telas menores.
- **Implementação da Coluna "Ações"**:
  - Adicionar botão **Editar**:
    - Usuário comum: Habilitado apenas se `realizado === false`.
    - `adm_master`: Habilitado sempre.
  - Adicionar botão **Excluir**:
    - Visível apenas para `adm_master`.
    - Incluir `AlertDialog` de confirmação.

#### 3. Relatório com Período Customizado
- Substituir o botão de exportação direta por um pequeno formulário ou diálogo de seleção de período (`data_inicial` e `data_final`).
- Definir o mês atual como padrão.
- Ajustar a lógica de filtragem no `handleExportReport` para respeitar o intervalo selecionado.

#### 4. Atualização do Hook (`useAcrescimoFuncao.ts`)
- Adicionar mutações para `updateSolicitacao` e `deleteSolicitacao`.
- Garantir que a revalidação do cache do TanStack Query (`acrescimos-funcao-solicitacoes`) ocorra após cada operação.

#### 5. Restrição de Visibilidade
- Garantir que a coluna de **Valor (R$)** na tabela e no CSV exportado permaneça visível apenas para `adm_master`.
