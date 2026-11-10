import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

// Layout institucional PreverMed para os e-mails da Agenda
export const Layout = ({ preview, titulo, children }: { preview: string; titulo: string; children: React.ReactNode }) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0 }}>
      <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Section style={{ backgroundColor: '#0b4f8a', padding: '20px 28px' }}>
          <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, margin: 0 }}>PreverMed</Text>
          <Text style={{ color: '#cfe3f5', fontSize: '12px', margin: '2px 0 0' }}>Medicina e Segurança do Trabalho</Text>
        </Section>
        <Section style={{ padding: '24px 28px' }}>
          <Heading style={{ color: '#0b4f8a', fontSize: '20px', margin: '0 0 16px' }}>{titulo}</Heading>
          {children}
        </Section>
        <Hr style={{ borderColor: '#e2e8f0', margin: '0 28px' }} />
        <Text style={{ color: '#64748b', fontSize: '12px', padding: '12px 28px', margin: 0 }}>
          Mensagem automática do Portal PreverMed. Guarde o número do protocolo para qualquer contato com nossa equipe.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const P = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: '#1e293b', fontSize: '14px', lineHeight: '22px', margin: '0 0 12px' }}>{children}</Text>
)

export const Dados = ({ linhas }: { linhas: [string, string | undefined | null][] }) => (
  <Section style={{ backgroundColor: '#f1f6fb', borderRadius: '8px', padding: '12px 16px', margin: '8px 0 16px' }}>
    {linhas.filter(([, v]) => v).map(([k, v]) => (
      <Text key={k} style={{ fontSize: '14px', color: '#1e293b', margin: '4px 0' }}>
        <strong style={{ color: '#0b4f8a' }}>{k}:</strong> {v}
      </Text>
    ))}
  </Section>
)

export const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : undefined)
