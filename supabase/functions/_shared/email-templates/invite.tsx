/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Você recebeu um convite para acessar {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://woqyhugzztdjpkfwkolu.supabase.co/storage/v1/object/public/email-assets/logo-prevermed.png" alt="PreverMed" width="180" style={{ margin: '0 0 24px', height: 'auto' }} />
        <Heading style={h1}>Convite para o portal</Heading>
        <Text style={text}>
          Você recebeu um convite para acessar{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Confirme o convite para criar seu acesso ao portal.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Aceitar convite
        </Button>
        <Text style={footer}>
          Se você não esperava este convite, desconsidere este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(215, 25%, 15%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(215, 15%, 45%)',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(210, 85%, 45%)',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid hsl(210, 85%, 45%)',
  borderRadius: '10px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: 'hsl(215, 15%, 45%)', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: hsl(210, 85%, 45%) !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: hsl(210, 85%, 45%) !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: hsl(210, 85%, 45%) !important; color: #ffffff !important; }
`
