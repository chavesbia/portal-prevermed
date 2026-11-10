import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Aviso, Dados, Layout, P, Protocolo, dataBR, enderecoDe } from './agenda-layout.tsx'

interface Props { protocolo?: string; nome?: string; colaborador?: string; empresa?: string; tipoExame?: string; data?: string; hora?: string; unidade?: string; motivo?: string }

const Email = (p: Props) => (
  <Layout preview={`Recebemos sua solicitação ${p.protocolo ?? ''}`} titulo="Solicitação recebida">
    <Protocolo valor={p.protocolo} />
    {p.nome ? <P>{`Olá, ${p.nome}.`}</P> : null}
    <Dados linhas={[['Empresa', p.empresa], ['Colaborador', p.colaborador], ['Tipo de exame', p.tipoExame], ['Local de atendimento', [p.unidade, enderecoDe(p.unidade)].filter(Boolean).join(', ') || undefined], ['Data', dataBR(p.data)], ['Horário', p.hora ? `${p.hora}h` : undefined]]} />
    <Aviso>{p.motivo ?? 'Nossa equipe vai conferir as informações e você receberá a confirmação por e-mail.'} O horário só fica confirmado após a aprovação.</Aviso>
  </Layout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Solicitação recebida – protocolo ${d.protocolo ?? ''}`,
  displayName: 'Agenda – Solicitação recebida',
  previewData: { protocolo: 'AG-20261110-7E5425', nome: 'Maria', colaborador: 'JOÃO DA SILVA', empresa: 'EMPRESA EXEMPLO LTDA', tipoExame: 'Retorno ao Trabalho', data: '2026-11-12', hora: '08:30', unidade: 'Lapa' },
} satisfies TemplateEntry
