// Inclusão de agendamento no SOC via SOAP (AgendamentoWs) com autenticação WSS
const URL_WS = 'https://ws1.soc.com.br/WSSoc/AgendamentoWs';

const TIPO: Record<string, string> = {
  'Admissional': 'ADMISSIONAL',
  'Periódico': 'PERIODICO',
  'Demissional': 'DEMISSIONAL',
  'Retorno ao Trabalho': 'RETORNO_TRABALHO',
  'Mudança de Risco': 'MUDANCA_FUNCAO',
  'Monitoração Pontual': 'MONITORACAO_PONTUAL',
  'Consulta': 'CONSULTA',
  'Consulta Assistencial': 'CONSULTA_ASSISTENCIAL',
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function wssHeader(user: string, senha: string) {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const now = new Date();
  const created = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const expires = new Date(now.getTime() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const enc = new TextEncoder();
  const buf = new Uint8Array([...nonce, ...enc.encode(created), ...enc.encode(senha)]);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', buf));
  const b64 = (a: Uint8Array) => btoa(String.fromCharCode(...a));
  return `<wsse:Security soap:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
<wsu:Timestamp wsu:Id="TS-1"><wsu:Created>${created}</wsu:Created><wsu:Expires>${expires}</wsu:Expires></wsu:Timestamp>
<wsse:UsernameToken wsu:Id="UT-1"><wsse:Username>${esc(user)}</wsse:Username>
<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${b64(digest)}</wsse:Password>
<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${b64(nonce)}</wsse:Nonce>
<wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security>`;
}

const tag = (xml: string, n: string) => xml.match(new RegExp(`<(?:\\w+:)?${n}>([\\s\\S]*?)</(?:\\w+:)?${n}>`))?.[1]?.trim() ?? null;

export async function incluirAgendamentoSoc(p: {
  codigoEmpresa: string; cpf: string; codigoAgenda: string;
  data: string; hora: string; tipoExame: string; detalhes: string;
}): Promise<{ ok: boolean; codigoAgendamento?: string | null; erro?: string; resposta: string }> {
  const user = Deno.env.get('SOC_WS_USUARIO');
  const senha = Deno.env.get('SOC_WS_CHAVE');
  const resp = Deno.env.get('SOC_WS_CODIGO_RESPONSAVEL');
  const principal = Deno.env.get('SOC_CODIGO_EMPRESA');
  if (!user || !senha || !resp || !principal) return { ok: false, erro: 'Credenciais do Web Service SOC ausentes', resposta: '' };
  // Cabeçalho WSS exige prefixo "U"; payload usa o código numérico puro
  const codUser = user.replace(/^U/i, '');
  const wsUser = `U${codUser}`;

  const [y, m, d] = p.data.split('-');
  const [hh, mm] = p.hora.split(':').map(Number);
  const fim = new Date(0, 0, 1, hh, mm + 15);
  const horaFinal = `${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}`;

  const body = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://services.soc.age.com/">
<soap:Header>${await wssHeader(wsUser, senha)}</soap:Header>
<soap:Body><ser:incluirAgendamento><IncluirAgendamentoWsVo>
<identificacaoWsVo><codigoEmpresaPrincipal>${esc(principal)}</codigoEmpresaPrincipal><codigoResponsavel>${esc(resp)}</codigoResponsavel><codigoUsuario>${esc(codUser)}</codigoUsuario></identificacaoWsVo>
<dadosAgendamentoWsVo>
<tipoBuscaEmpresa>CODIGO_SOC</tipoBuscaEmpresa><codigoEmpresa>${esc(p.codigoEmpresa)}</codigoEmpresa>
<reservarCompromissoParaEmpresa>false</reservarCompromissoParaEmpresa>
<tipoBuscaFuncionario>CPF_ATIVO</tipoBuscaFuncionario><codigoFuncionario>${esc(p.cpf)}</codigoFuncionario>
<codigoUsuarioAgenda>${esc(String(p.codigoAgenda).replace(/^0+(?=\d)/, ''))}</codigoUsuarioAgenda>
...
<codigoCompromisso>1</codigoCompromisso><usaOutroCompromisso>false</usaOutroCompromisso>
<tipoCompromisso>${TIPO[p.tipoExame] ?? 'CONSULTA'}</tipoCompromisso>
<detalhes>${esc(p.detalhes.slice(0, 1900))}</detalhes>
<priorizarAtendimento>false</priorizarAtendimento><atendido>NAO</atendido>
<usaEnviarEmail>false</usaEnviarEmail><usaEnviarSocms>false</usaEnviarSocms><convocacaoAgendada>false</convocacaoAgendada>
</dadosAgendamentoWsVo></IncluirAgendamentoWsVo></ser:incluirAgendamento></soap:Body></soap:Envelope>`;

  try {
    const r = await fetch(URL_WS, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const txt = await r.text();
    const codigo = tag(txt, 'codigoAgendamento');
    const fault = tag(txt, 'faultstring');
    const msg = tag(txt, 'mensagemErro') ?? tag(txt, 'mensagem');
    const erroFlag = tag(txt, 'numeroErros');
    if (r.ok && codigo && !fault && (!erroFlag || erroFlag === '0')) return { ok: true, codigoAgendamento: codigo, resposta: txt.slice(0, 4000) };
    return { ok: false, erro: fault ?? msg ?? `HTTP ${r.status}`, resposta: txt.slice(0, 4000) };
  } catch (e) {
    return { ok: false, erro: String(e), resposta: '' };
  }
}
