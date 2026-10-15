# Agendamento SOCNET — quais Exporta Dados usar

## Principal: "Guia de Encaminhamento de Exames" (Considera SOCNET: Sim)
- Filtros: `nrGuia` + `paramGuia=1` (guia específica) **ou** `funcionario` (código, nome ou CPF) + `paramFunc=1`; `dataInicio/dataFim` obrigatório (máx. 30 dias, com `paramData`); `unidade`, `nomepresta`.
- Retorna tudo que o agendamento precisa: NUMEROGUIA, CODIGOFICHA, STATUSGUIA (1 = atendido), empresa (código/CNPJ/subgrupo/nome), unidade, setor, cargo, funcionário (nome, CPF, matrícula, sexo 1/2, nascimento), prestador, CODIGOTIPOEXAME/TIPOEXAME, **NOMEEXAME / CODIGOSOCEXAME / TUSS / AMB** (uma linha por exame), DATAEXAMEGUIA, EMPRESATRABALHO, prestador de repasse (vem em branco).
- Uso: cliente informa nº da guia ou CPF → exames e dados pré-preenchidos; STATUSGUIA=1 bloqueia (já atendida).

## Varredura: "Exames direcionado ao meu prestador SOCNET" (Sim)
- Filtros: `DataInicio`, `empresasFiltro` (opcional). Gerar na Empresa Principal.
- Lista todos os pedidos de outras bases SOCNET direcionados à PreverMed: empresa de repasse, empresa, funcionário/CPF, exames (código, mapeado, TUSS), DATAFICHA, TIPOEXAME, SEQUENCIALFICHA, DATARESULTADO.
- Uso: fila diária de "pedidos SOCNET aguardando agendamento" e exames pendentes de resultado. Não cobre repasse do repasse.

## Complementares
- "Pedido de Exame por Código Sequencial" (Sim) — `empresaTrabalho` + `codigoSequencial`: dados completos do colaborador/ficha a partir do CODIGOFICHA.
- "Sequenciais Guia - Por Empresa Principal" (Sim) — já configurado (222211): só códigos; serve para validar a guia.
- "Exames do Funcionário SOCNET" (Sim) — exames aplicados e vencimentos (tela 238).
- "Pedido Exame" (não SOCNET) — por CPF/período, base própria; útil para fila de exames/etiquetas (o que integradores como a VALC usam).
- Futuro ASO: "ASO" (Sim, por sequencial), "ASOs no período", "Dados ASO com exames", "Convocação de Exames" (Sim).
