# Roadmap — Agendamentos

## Feito
- [x] Confirmação/alteração de lotação na tela do CPF (WhatsApp) com gravação no SOC antes dos exames
- [x] Menu de exames: 1-Adicionar / 2-Remover, sem selo/texto "PCMSO"
- [x] Kit/Guia só para Parceiras/Pontual (e SOCNET/externo), opcional, com aviso do balcão
- [x] 4 horários espaçados no WhatsApp
- [x] "Consulta Assistencial" removida da página pública
- [x] Detalhes enviados ao SOC em maiúsculo, sem acento, com linha em branco entre blocos

## Em aberto
- [x] Confirmação de lotação na página pública; confirmação testada com cadastro ativo, escrita de alteração ainda não testada no SOC
- [ ] Reativar cadastro inativo quando não houver demissional — bloqueado: falta relatório SOC completo de histórico demissional; DATA_DEMISSAO não comprova exame
- [x] Painel: período D-5/D+5, ordenação, filtros rápidos, busca, controle de kit impresso; persistência de impressão testada e estado original restaurado
- [ ] SOCNET: fallback 212792 implementado e chave salva; teste real retornou guiaIndisponivel=true — bloqueado até validar habilitação/chave/máscara do Exporta no SOC
- [x] Catálogo com 23 preparos oficiais da planilha nos comprovantes público e WhatsApp; correspondência testada, emissão real ainda não testada
- [ ] Leitura de guias com IA (OCR) — versão futura

## Solicitação atual
- Executar os itens em aberto acima, exceto OCR; não expor chaves do SOC no chat.
