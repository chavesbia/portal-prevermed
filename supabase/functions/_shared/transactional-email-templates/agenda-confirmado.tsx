import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Dados, Layout, P, dataBR } from './agenda-layout.tsx'

interface Props { protocolo?: string; nome?: string; colaborador?: string; empresa?: string; tipoExame?: string; data?: string; hora?: string; unidade?: string; exames?: string[]; preparos?: { nome: string; texto: string }[] }

const Email = (p: Props) => (
  <Layout preview={`Agendamento confirmado ${dataBR(p.data) ?? ''} ${p.hora ?? ''}`} titulo="Agendamento confirmado">
    <P>{p.nome ? `Olá, ${p.nome}.` : 'Olá.'}</P>
    <P>O agendamento abaixo está confirmado. Chegue com 15 minutos de antecedência e traga documento oficial com foto.</P>
    <Dados linhas={[['Protocolo', p.protocolo], ['Colaborador', p.colaborador], ['Empresa', p.empresa], ['Tipo de exame', p.tipoExame], ['Data', dataBR(p.data)], ['Horário', p.hora], ['Unidade', p.unidade], ['Exames', p.exames?.length ? p.exames.join(', ') : undefined]]} />
    {p.preparos?.length ? (<>
      <P><strong>Preparo dos exames</strong></P>
      {p.preparos.map((x) => (
        <Text key={x.nome} style={{ fontSize: '13px', color: '#1e293b', margin: '0 0 10px', whiteSpace: 'pre-line' }}>
          <strong>{x.nome}</strong>{'\n'}{x.texto.trim()}
        </Text>
      ))}
    </>) : null}
  </Layout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Agendamento confirmado – ${d.data ? dataBR(d.data) : ''} ${d.hora ?? ''} – protocolo ${d.protocolo ?? ''}`,
  displayName: 'Agenda – Agendamento confirmado',
  previewData: { protocolo: 'AG-20261110-7E5425', nome: 'Maria', colaborador: 'JOÃO DA SILVA', empresa: 'EMPRESA EXEMPLO LTDA', tipoExame: 'Retorno ao Trabalho', data: '2026-11-12', hora: '08:30', unidade: 'Lapa', exames: ['AUDIOMETRIA'], preparos: [{ nome: 'AUDIOMETRIA', texto: '* Estar com os ouvidos limpos.' }] },
} satisfies TemplateEntry
