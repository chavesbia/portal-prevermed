import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

const LOGO = 'https://woqyhugzztdjpkfwkolu.supabase.co/storage/v1/object/public/email-assets/logo-prevermed.png'
// Layout institucional PreverMed para os e-mails da Agenda
export const Layout = ({ preview, titulo, children }: { preview: string; titulo: string; children: React.ReactNode }) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: '#f6f8fa', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '24px 0' }}>
      <Container style={{ maxWidth: '560px', margin: '0 auto' }}>
        <Section style={{ padding: '8px 16px 16px', textAlign: 'center' }}>
          <Img src={LOGO} alt="PreverMed" width="130" style={{ margin: '0 auto', height: 'auto' }} />
          <Text style={{ color: '#0f172a', fontSize: '18px', fontWeight: 600, margin: '12px 0 0' }}>Agendamento de Exames</Text>
        </Section>
        <Section style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '24px 20px' }}>
          <Text style={{ textAlign: 'center', fontSize: '30px', lineHeight: '34px', margin: '0 0 6px' }}>📅</Text>
          <Heading style={{ color: '#0f172a', fontSize: '16px', fontWeight: 600, margin: '0 0 10px', textAlign: 'center' }}>{titulo}</Heading>
          {children}
        </Section>
        <Hr style={{ borderColor: '#e2e8f0', margin: '16px 16px 0' }} />
        <Text style={{ color: '#64748b', fontSize: '11px', padding: '10px 16px', margin: 0, textAlign: 'center' }}>
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
  <Section style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', margin: '8px 0 16px' }}>
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}><tbody>
      {linhas.filter(([, v]) => v).map(([k, v]) => (
        <tr key={k}>
          <td style={{ fontSize: '12px', color: '#64748b', padding: '5px 12px 5px 0', verticalAlign: 'top', whiteSpace: 'nowrap', width: '38%' }}>{k}</td>
          <td style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600, padding: '5px 0', verticalAlign: 'top' }}>{v}</td>
        </tr>
      ))}
    </tbody></table>
  </Section>
)

export const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : undefined)

// Protocolo em destaque, como no comprovante do portal
export const Protocolo = ({ valor }: { valor?: string }) => valor ? (
  <Section style={{ textAlign: 'center', margin: '0 0 16px' }}>
    <Text style={{ fontFamily: 'Courier New, monospace', fontSize: '20px', letterSpacing: '1px', color: '#0f172a', margin: 0 }}>{valor}</Text>
    <Text style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>Guarde este número de protocolo.</Text>
  </Section>
) : null

// Endereço por unidade de atendimento
export const enderecoDe = (unidade?: string) =>
  /osasco/i.test(unidade ?? '') ? 'Rua Avelino Lopes, 248 - Centro - Osasco - SP'
  : /lapa/i.test(unidade ?? '') ? 'Rua Afonso Sardinha, 155 - Lapa - São Paulo - SP' : undefined

// Caixa azul de aviso, igual ao comprovante do portal
export const Aviso = ({ children }: { children: React.ReactNode }) => (
  <Section style={{ backgroundColor: '#f0f6fd', border: '1px solid #9cc3ec', borderRadius: '8px', padding: '10px 14px', margin: '0 0 12px' }}>
    <Text style={{ fontSize: '12px', lineHeight: '18px', color: '#0f172a', margin: 0 }}>{children}</Text>
  </Section>
)
