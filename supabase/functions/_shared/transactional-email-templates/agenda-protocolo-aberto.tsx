import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Dados, Layout, P, dataBR } from './agenda-layout.tsx'

interface Props { protocolo?: string; nome?: string; colaborador?: string; empresa?: string; tipoExame?: string; data?: string; hora?: string; unidade?: string; motivo?: string }

const Email = (p: Props) => (
  <Layout preview={`Recebemos sua solicitação ${p.protocolo ?? ''}`} titulo="Solicitação recebida">
    {p.nome ? <P>{`Olá, ${p.nome}.`}</P> : null}
    <P>Recebemos sua solicitação de agendamento. {p.motivo ?? 'Nossa equipe vai conferir as informações e você receberá a confirmação por e-mail.'}</P>
    <Dados linhas={[['Protocolo', p.protocolo], ['Colaborador', p.colaborador], ['Empresa', p.empresa], ['Tipo de exame', p.tipoExame], ['Data pretendida', dataBR(p.data)], ['Horário', p.hora], ['Unidade', p.unidade]]} />
    <P>Atenção: o atendimento só está garantido após a confirmação.</P>
  </Layout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Solicitação recebida – protocolo ${d.protocolo ?? ''}`,
  displayName: 'Agenda – Solicitação recebida',
  previewData: { protocolo: 'AG-20261110-7E5425', nome: 'Maria', colaborador: 'JOÃO DA SILVA', empresa: 'EMPRESA EXEMPLO LTDA', tipoExame: 'Retorno ao Trabalho', data: '2026-11-12', hora: '08:30', unidade: 'Lapa' },
} satisfies TemplateEntry
