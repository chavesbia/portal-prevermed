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
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Seu link de acesso ao {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://woqyhugzztdjpkfwkolu.supabase.co/storage/v1/object/public/email-assets/logo-prevermed.png" alt="PreverMed" width="180" style={{ margin: '0 0 24px', height: 'auto' }} />
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>
          Acesse o {siteName} pelo botão abaixo. Este link tem validade limitada.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Entrar no portal
        </Button>
        <Text style={footer}>
          Se você não solicitou este link, desconsidere este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
