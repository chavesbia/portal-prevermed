import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Dados, Layout, P } from './agenda-layout.tsx'

interface Props { protocolo?: string; nome?: string; colaborador?: string; empresa?: string; concluido?: boolean }

const Email = (p: Props) => (
  <Layout preview={p.concluido ? 'Documentação aprovada: já pode agendar' : 'Documentação em análise pela Saúde'} titulo={p.concluido ? 'Documentação aprovada, já pode agendar' : 'Retorno ao Trabalho em análise pela Saúde'}>
    {p.nome ? <P>{`Olá, ${p.nome}.`}</P> : null}
    <P>{p.concluido
      ? 'Nossa equipe de Saúde aprovou a documentação do Retorno ao Trabalho. Agora você já pode escolher a unidade, o dia e o horário do exame pelo Portal ou pelo WhatsApp, informando o CPF do colaborador. A liberação vale por 15 dias.'
      : 'Recebemos a documentação do Retorno ao Trabalho. Nossa equipe de Saúde vai analisar e avisaremos por e-mail e WhatsApp quando estiver liberado para escolher o dia e o horário.'}</P>
    <Dados linhas={[['Protocolo', p.protocolo], ['Colaborador', p.colaborador], ['Empresa', p.empresa]]} />
  </Layout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => d.concluido ? `Documentação aprovada, já pode agendar, protocolo ${d.protocolo ?? ''}` : `Retorno ao Trabalho em análise, protocolo ${d.protocolo ?? ''}`,
  displayName: 'Agenda – Retorno ao Trabalho (Saúde)',
  previewData: { protocolo: 'RET-20261110-7E5425', nome: 'Maria', colaborador: 'JOÃO DA SILVA', empresa: 'EMPRESA EXEMPLO LTDA' },
} satisfies TemplateEntry
