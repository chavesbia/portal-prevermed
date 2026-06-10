
# Reestruturação — Gestão de Contratos

Com base nas suas respostas, vou separar **Cliente** de **Contrato** (1→N), preservando todo o cadastro atual e criando histórico contratual por CNPJ.

## 1. Modelo de dados

### Nova tabela `commercial_contracts`
Um cliente passa a ter N contratos. Campos:

- `client_id` → FK `commercial_clients`
- `contract_number` (Nº Contrato)
- `proposal_number` (Nº Proposta)
- `prospect_status` (Situação prospecção)
- `modelo_contratual` *(enum: Gestão Ocupacional | Parceira | Por Uso)* — vindo da coluna "Tipo de Contrato" da planilha
- `contract_year` (Ano de emissão/redação — campo independente, **não derivado** de start_date)
- `start_date` (Vigência início)
- `end_date` (Data de vencimento)
- `signed` (Assinatura: Sim/Não)
- `auto_renewal` (Renovação automática)
- `renewal_term_months` (Tempo de renovação)
- `has_exam_table` (Tabela de Exames: Sim/Não)
- `has_service_table` (Tabela de Serviços: Sim/Não)
- `is_current` (boolean — marca o contrato vigente do cliente)
- `status_derivado` (calculado: Vigente / Vencido / Em renovação / Aguardando aditivo / Cancelado)
- `notes`

### `commercial_clients` — o que muda
**Mantém o `subgroup` SOC** (Gestão Ocupacional com eSocial, SOCNET, etc.) como detalhe operacional.
Campos `contract_number`, `contract_start_date`, `contract_end_date`, `contract_signed`, `proposal_number` ficam **deprecated** na tabela do cliente (mantidos para compatibilidade) e passam a ser derivados do contrato marcado como `is_current`.

### Anexos
Estendo `client_attachments` com `contract_id` (nullable) para vincular o PDF do contrato original ao registro contratual específico — assim um contrato de 2021 mantém sua tabela de exames original mesmo após reajustes no SOC.

## 2. Migração dos dados existentes

Para cada cliente atual:
- Se `contract_end_date` ≥ hoje **OU** vazio → criar 1 contrato com `is_current = true`, copiando dados embutidos.
- Se vencido → criar contrato com `is_current = false`, status "Vencido", e cliente fica sem contrato vigente (aparece em alerta).
- Coluna "Vencido" e "Tempo de renovação" da planilha são respeitados na importação inicial.

## 3. Importação "Catálogo Geral"

Novo modo no `CommercialImport`:
- Match por **CNPJ**.
- Cada linha = **um contrato** (não sobrescreve cliente).
- Cliente novo → cria cliente + contrato.
- Cliente existente → adiciona contrato ao histórico; se for mais recente que o atual `is_current`, oferece marcar como vigente.
- Normaliza: Tipo de Contrato → enum `modelo_contratual`; datas dd/mm/yyyy; Sim/Não → boolean.
- Linhas com `Tipo de Contrato` vazio entram com flag `revisao_pendente = true`.
- **Abas "Aguardando retorno" e "Fernanda" não são importadas** (ação manual da área).

## 4. UI — Detalhe do Cliente

Novo bloco **"Histórico de Contratos"** dentro de `CommercialClientDetail`:
- Tabela cronológica (mais recente → antigo): Nº Contrato | Ano | Modelo | Vigência | Vencimento | Status | Assinado | Renov. automática | Tabela Exames | Anexo.
- Botões: **"Novo contrato"**, **"Renovar contrato vigente"** (clona vigente, ajusta datas, marca novo como `is_current`).
- Linha do contrato vigente destacada.
- Upload de PDF do contrato anexado a cada linha (histórico preservado).

## 5. Dashboards / Indicadores

Adicionar cards em `CommercialDashboard` / `CommercialIndicators`:
- Vencimentos próximos (30/60/90 dias) — por contrato vigente.
- Renovações automáticas vs manuais.
- Distribuição por **Modelo Contratual** (3 macro-tipos).
- Contratos por ano de emissão (2021–2027).
- Clientes sem contrato vigente.

## 6. Permissões

Sem mudança — segue gated em `/carteira-comercial`. RLS dos novos contratos espelha `commercial_clients` (via `can_view_module_route`).

---

## Detalhes técnicos

- **Migração SQL**: cria `commercial_contracts` com GRANTs + RLS + policies; trigger para garantir apenas 1 `is_current` por cliente; backfill a partir de `commercial_clients`.
- **Tipos**: regenera `src/integrations/supabase/types.ts` após migration.
- **Hooks novos**: `useCommercialContracts(clientId)` com CRUD + `setCurrentContract`.
- **`commercial-status.ts`**: passa a operar sobre `Contract` em vez de `Client` (cliente herda do vigente).
- **`commercial-import.ts`**: novo parser `parseCatalogoGeral` + branch `'catalogo'` no modo de importação.

## Pontos que não fazem parte deste plano
- Cálculo automático de multa proporcional (aba Fernanda) — fica para fase futura.
- Reajustes automáticos de tabela de exames — fora de escopo (continua manual via SOC).

Confirma para eu seguir com migração + código?
