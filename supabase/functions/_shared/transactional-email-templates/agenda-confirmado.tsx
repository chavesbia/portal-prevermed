import * as React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Dados, Layout, P, Protocolo, dataBR, enderecoDe } from './agenda-layout.tsx'

interface Props { protocolo?: string; nome?: string; colaborador?: string; empresa?: string; tipoExame?: string; data?: string; hora?: string; unidade?: string; exames?: string[]; preparos?: { nome: string; texto: string }[] }

const Email = (p: Props) => (
  <Layout preview={`Pré-agendamento confirmado ${dataBR(p.data) ?? ''} ${p.hora ?? ''}`} titulo="Pré-agendamento confirmado">
    <Protocolo valor={p.protocolo} />
    {p.nome ? <P>{`Olá, ${p.nome}.`}</P> : null}
    <Dados linhas={[['Empresa', p.empresa], ['Colaborador', p.colaborador], ['Tipo de exame', p.tipoExame], ['Exames', p.exames?.length ? p.exames.join(', ') : undefined], ['Local de atendimento', [p.unidade, enderecoDe(p.unidade)].filter(Boolean).join(', ') || undefined], ['Data', dataBR(p.data)], ['Horário', p.hora ? `${p.hora}h` : undefined]]} />
    <Section style={{ backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '12px 16px', margin: '0 0 16px' }}>
      <Text style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600, margin: '0 0 6px' }}>Leve um documento oficial de identificação com foto.</Text>
      <Text style={{ fontSize: '13px', color: '#475569', margin: 0 }}>Este é um pré-agendamento, feito para agilizar a abertura da ficha na recepção. O horário é uma previsão de chegada e não garante atendimento exatamente no horário marcado, o atendimento segue a ordem de acolhimento.</Text>
    </Section>
    <P><strong>Preparo dos exames</strong></P>
    {p.preparos?.length ? p.preparos.map((x) => (
      <Text key={x.nome} style={{ fontSize: '13px', color: '#1e293b', margin: '0 0 10px', whiteSpace: 'pre-line', borderLeft: '3px solid #0b4f8a', paddingLeft: '10px' }}>
        <strong>{x.nome}</strong>{'\n'}{x.texto.replace(/\r/g, '').trim()}
      </Text>
    )) : (
      <Text style={{ fontSize: '13px', color: '#475569', margin: '0 0 10px' }}>Os exames deste atendimento não exigem preparo prévio especial. Compareça com documento oficial com foto e, se houver, relatórios médicos anteriores.</Text>
    )}
  </Layout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Pré-agendamento confirmado – ${d.data ? dataBR(d.data) : ''} ${d.hora ?? ''} – protocolo ${d.protocolo ?? ''}`,
  displayName: 'Agenda – Pré-agendamento confirmado',
  previewData: { protocolo: 'AG-20261110-7E5425', nome: 'Maria', colaborador: 'JOÃO DA SILVA', empresa: 'EMPRESA EXEMPLO LTDA', tipoExame: 'Retorno ao Trabalho', data: '2026-11-12', hora: '08:30', unidade: 'Lapa', exames: ['AUDIOMETRIA'], preparos: [{ nome: 'AUDIOMETRIA', texto: '* Estar com os ouvidos limpos.' }] },
} satisfies TemplateEntry
