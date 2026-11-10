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

## OS 12369
- [x] Conferir a unidade no SOC: hierarquia retornou lista vazia e sincronização de unidades concluída sem erros; nenhuma unidade da Studio Retrofit foi recebida.
- [ ] Recuperar e vincular a unidade confirmada à OS com auditoria e validar sua seleção na finalização, sem encerrar o PPP pela equipe — bloqueado: falta confirmação do cadastro e código real na Tela 231 do SOC; não criar Matriz 001 presumida.

## Subgrupos (09/11)
- [x] Subgrupo oficial de toda a carteira via Exporta 218427 (rotina SOC + botão Sincronizar em Admin > Empresas)
- [x] 0003 Por Uso na esteira da Engenharia (só 0002/0004/0010 livres)
- [ ] Primeira carga real — aguardando a Bia clicar em Sincronizar (sem sessão ADM Master no ambiente de teste)
- [ ] Painel Gestor — plano guardado no histórico, complementar com a Bia

## E-mails (10/11)
- [x] Preparar o serviço gerenciado e os seis modelos de autenticação em português com identidade PreverMed.
- [x] Implantar o auth-email-hook; conferência confirmou a remoção do bloqueio por função ausente.
- [ ] Ativação do domínio notify.portal.prevermed.com.br — aguardando verificação DNS automática; envio real ainda não testado.
