# Base permanente de documentação SOC

Consultar ANTES de propor ou construir qualquer integração com o SOC (agenda, SOCNET, ASO, exames, funcionários).

- `manuais/` — texto integral de todos os manuais enviados (12 módulos da Central de Ajuda + manuais técnicos dos Web Services). Pesquisar com `rg -i "termo" docs/soc/manuais`.
- `exporta-dados-catalogo.md` — os 207 Exporta Dados da vitrine oficial, por grupo, com filtros, campos e se consideram SOCNET.
- `socnet-agendamento.md` — decisão de quais Exporta Dados usar no agendamento SOCNET e no controle futuro de ASO/exames pendentes.

## Regras gerais (manual 37, cap. Exporta Dados)
- Endpoint: `https://ws1.soc.com.br/WebSoc/exportadados?parametro={json}`.
- Para usar: tela 733 → "Copia Exporta Dados" da vitrine → gravar; o SOC gera **código + chave** na base PreverMed.
- Exporta Dados não tem acesso nativo SOCNET pela tela; via Web Service só funcionam em empresa SOCNET os que marcam "Considera SOCNET? Sim".
- Máximo 5 execuções simultâneas do mesmo Exporta Dados. Muitos exigem período de no máximo 30 dias.
- Telas: 248 Pedido de Exames · 229 Ficha Clínica · 250 Resultado · 264 ASO · 238 Aplicação de Exames · 675 Encaminhamento SOCNET · 189 Pessoas · 733 Exporta Dados.
