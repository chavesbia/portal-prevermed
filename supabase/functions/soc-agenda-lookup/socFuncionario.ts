// Pré-cadastro de colaborador no SOC via SOAP (FuncionarioModelo2Ws / importacaoFuncionario)
const URL_WS = 'https://ws1.soc.com.br/WSSoc/FuncionarioModelo2Ws';

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

export type Ref = { codigo?: string; nome?: string };
const vo = (nome: string, r: Ref) => r.codigo
  ? `<${nome}><codigo>${esc(r.codigo)}</codigo><tipoBusca>CODIGO</tipoBusca></${nome}>`
  : `<${nome}><nome>${esc((r.nome ?? '').toUpperCase())}</nome><tipoBusca>NOME</tipoBusca></${nome}>`;

export async function cadastrarFuncionarioSoc(p: {
  codigoEmpresa: string; cpf: string; nome: string; dataNascimento: string; sexo: 'MASCULINO' | 'FEMININO';
  dataAdmissao: string; unidade: Ref; setor: Ref; cargo: Ref; podeCriar: boolean;
}): Promise<{ ok: boolean; codigoFuncionario?: string | null; erro?: string }> {
  const user = Deno.env.get('SOC_WS_USUARIO');
  const senha = Deno.env.get('SOC_WS_CHAVE');
  const resp = Deno.env.get('SOC_WS_CODIGO_RESPONSAVEL');
  const principal = Deno.env.get('SOC_CODIGO_EMPRESA');
  if (!user || !senha || !resp || !principal) return { ok: false, erro: 'Credenciais do Web Service SOC ausentes' };
  const codUser = user.replace(/^U/i, '');
  const br = (iso: string) => iso.split('-').reverse().join('/');
  const criar = p.podeCriar ? 'true' : 'false';

  const body = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://services.soc.age.com/">
<soap:Header>${await wssHeader(`U${codUser}`, senha)}</soap:Header>
<soap:Body><ser:importacaoFuncionario><Funcionario>
<atualizarCargo>false</atualizarCargo><atualizarFuncionario>false</atualizarFuncionario><atualizarSetor>false</atualizarSetor><atualizarUnidade>false</atualizarUnidade>
${vo('cargoWsVo', p.cargo)}
<criarCargo>${criar}</criarCargo><criarFuncionario>true</criarFuncionario><criarSetor>${criar}</criarSetor><criarUnidade>${criar}</criarUnidade>
<funcionarioWsVo>
<chaveProcuraFuncionario>CPF</chaveProcuraFuncionario>
<codigoEmpresa>${esc(p.codigoEmpresa)}</codigoEmpresa><tipoBuscaEmpresa>CODIGO_SOC</tipoBuscaEmpresa>
<cpf>${esc(p.cpf)}</cpf><nomeFuncionario>${esc(p.nome.toUpperCase())}</nomeFuncionario>
<dataNascimento>${br(p.dataNascimento)}</dataNascimento><dataAdmissao>${br(p.dataAdmissao)}</dataAdmissao>
<regimeTrabalho>NORMAL</regimeTrabalho><estadoCivil>OUTROS</estadoCivil>
<sexo>${p.sexo}</sexo><situacao>PENDENTE</situacao><tipoContratacao>CLT</tipoContratacao>
<naoPossuiMatricula>true</naoPossuiMatricula>
</funcionarioWsVo>
<identificacaoWsVo><chaveAcesso>${esc(senha)}</chaveAcesso><codigoEmpresaPrincipal>${esc(principal)}</codigoEmpresaPrincipal><codigoResponsavel>${esc(resp)}</codigoResponsavel><codigoUsuario>${esc(codUser)}</codigoUsuario></identificacaoWsVo>
<naoImportarFuncionarioSemHierarquia>${p.podeCriar ? 'false' : 'true'}</naoImportarFuncionarioSemHierarquia>
${vo('setorWsVo', p.setor)}
${vo('unidadeWsVo', p.unidade)}
</Funcionario></ser:importacaoFuncionario></soap:Body></soap:Envelope>`;

  try {
    const r = await fetch(URL_WS, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' }, body });
    const text = await r.text();
    console.log('SOC funcionario', r.status, text.slice(0, 600));
    const fault = tag(text, 'faultstring');
    if (fault) return { ok: false, erro: fault };
    if (tag(text, 'encontrouErro') === 'true') return { ok: false, erro: tag(text, 'descricaoErro') ?? 'Erro no SOC' };
    return { ok: r.ok, codigoFuncionario: tag(text, 'codigoFuncionario'), erro: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}
