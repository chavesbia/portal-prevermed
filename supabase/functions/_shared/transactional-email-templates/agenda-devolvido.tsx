import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Dados, Layout, P } from './agenda-layout.tsx'

interface Props { protocolo?: string; nome?: string; colaborador?: string; empresa?: string; tipoExame?: string; motivo?: string }

const Email = (p: Props) => (
  <Layout preview={`Solicitação ${p.protocolo ?? ''} precisa de ajuste`} titulo="Solicitação devolvida">
    <P>{p.nome ? `Olá, ${p.nome}.` : 'Olá.'}</P>
    <P>Não foi possível seguir com a solicitação abaixo. Veja o motivo apontado pela nossa equipe e faça uma nova solicitação com as correções.</P>
    <Dados linhas={[['Protocolo', p.protocolo], ['Colaborador', p.colaborador], ['Empresa', p.empresa], ['Tipo de exame', p.tipoExame], ['Motivo', p.motivo]]} />
  </Layout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Solicitação devolvida – protocolo ${d.protocolo ?? ''}`,
  displayName: 'Agenda – Solicitação devolvida',
  previewData: { protocolo: 'AG-20261110-7E5425', nome: 'Maria', colaborador: 'JOÃO DA SILVA', empresa: 'EMPRESA EXEMPLO LTDA', tipoExame: 'Retorno ao Trabalho', motivo: 'Atestado de alta ilegível.' },
} satisfies TemplateEntry
