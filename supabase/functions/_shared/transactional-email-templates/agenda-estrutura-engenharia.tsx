import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Dados, Layout, P } from './agenda-layout.tsx'

interface Props { protocolo?: string; nome?: string; colaborador?: string; empresa?: string; unidade?: string; setor?: string; cargo?: string; concluido?: boolean }

const Email = (p: Props) => (
  <Layout preview={p.concluido ? 'Estrutura cadastrada: já pode agendar' : 'Solicitação enviada à Engenharia'} titulo={p.concluido ? 'Estrutura cadastrada – já pode agendar' : 'Solicitação em análise pela Engenharia'}>
    <P>{p.nome ? `Olá, ${p.nome}.` : 'Olá.'}</P>
    <P>{p.concluido
      ? 'Nossa Engenharia concluiu o cadastro da unidade/setor/cargo. Agora você já pode fazer o agendamento do exame pelo Portal ou WhatsApp.'
      : 'A empresa possui programas (PGR/PCMSO) sob responsabilidade da PreverMed e a unidade, setor ou cargo informado ainda não existe no cadastro. Nossa Engenharia vai analisar e incluir a estrutura antes da escolha da data. Avisaremos por e-mail quando estiver liberado.'}</P>
    <Dados linhas={[['Protocolo', p.protocolo], ['Colaborador', p.colaborador], ['Empresa', p.empresa], ['Unidade', p.unidade], ['Setor', p.setor], ['Cargo', p.cargo]]} />
  </Layout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => d.concluido ? `Estrutura cadastrada – protocolo ${d.protocolo ?? ''}` : `Solicitação em análise pela Engenharia – protocolo ${d.protocolo ?? ''}`,
  displayName: 'Agenda – Estrutura (Engenharia)',
  previewData: { protocolo: 'INC-20261110-7E5425', nome: 'Maria', colaborador: 'JOÃO DA SILVA', empresa: 'EMPRESA EXEMPLO LTDA', unidade: 'MATRIZ', setor: 'PRODUÇÃO', cargo: 'OPERADOR' },
} satisfies TemplateEntry
