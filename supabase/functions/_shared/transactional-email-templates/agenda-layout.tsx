import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

const LOGO = 'https://woqyhugzztdjpkfwkolu.supabase.co/storage/v1/object/public/email-assets/logo-prevermed.png'
// Layout institucional PreverMed para os e-mails da Agenda
export const Layout = ({ preview, titulo, children }: { preview: string; titulo: string; children: React.ReactNode }) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0 }}>
      <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Section style={{ padding: '28px 28px 8px', textAlign: 'center' }}>
          <Img src={LOGO} alt="PreverMed" width="180" style={{ margin: '0 auto', height: 'auto' }} />
          <Text style={{ color: '#0b4f8a', fontSize: '15px', fontWeight: 600, margin: '12px 0 0' }}>Agendamento de Exames</Text>
        </Section>
        <Section style={{ padding: '24px 28px' }}>
          <Heading style={{ color: '#0b4f8a', fontSize: '17px', margin: '0 0 16px', textAlign: 'center' }}>{titulo}</Heading>
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
  <Text style={{ color: '#1e293b', fontSize: '13px', lineHeight: '20px', margin: '0 0 12px' }}>{children}</Text>
)

export const Dados = ({ linhas }: { linhas: [string, string | undefined | null][] }) => (
  <Section style={{ backgroundColor: '#f1f6fb', borderRadius: '8px', padding: '12px 16px', margin: '8px 0 16px' }}>
    {linhas.filter(([, v]) => v).map(([k, v]) => (
      <Text key={k} style={{ fontSize: '13px', color: '#1e293b', margin: '4px 0' }}>
        <strong style={{ color: '#0b4f8a' }}>{k}:</strong> {v}
      </Text>
    ))}
  </Section>
)

export const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : undefined)

// Protocolo em destaque, como no comprovante do portal
export const Protocolo = ({ valor }: { valor?: string }) => valor ? (
  <Section style={{ textAlign: 'center', margin: '0 0 16px' }}>
    <Text style={{ fontFamily: 'Courier New, monospace', fontSize: '20px', color: '#0f172a', margin: 0 }}>{valor}</Text>
    <Text style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Guarde este número de protocolo.</Text>
  </Section>
) : null

// Endereço por unidade de atendimento
export const enderecoDe = (unidade?: string) =>
  /osasco/i.test(unidade ?? '') ? 'Rua Avelino Lopes, 248 - Centro - Osasco - SP'
  : /lapa/i.test(unidade ?? '') ? 'Rua Afonso Sardinha, 155 - Lapa - São Paulo - SP' : undefined
