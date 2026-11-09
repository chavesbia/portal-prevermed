// Inativa empresas no SOC via EmpresaWs (alterarEmpresa, ativo=false). ADM Master apenas.
// Travas: só subgrupo 0001 (Cancelado) e 0 vidas ativas no portal; máximo 30 por chamada; tudo auditado.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const URL_WS = 'https://ws1.soc.com.br/WSSoc/EmpresaWs';
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tag = (xml: string, n: string) => xml.match(new RegExp(`<(?:\\w+:)?${n}>([\\s\\S]*?)</(?:\\w+:)?${n}>`))?.[1]?.trim() ?? null;

async function wssHeader(user: string, senha: string) {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const now = new Date();
  const created = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const expires = new Date(now.getTime() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const enc = new TextEncoder();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', new Uint8Array([...nonce, ...enc.encode(created), ...enc.encode(senha)])));
  const b64 = (a: Uint8Array) => btoa(String.fromCharCode(...a));
  return `<wsse:Security soap:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
<wsu:Timestamp wsu:Id="TS-1"><wsu:Created>${created}</wsu:Created><wsu:Expires>${expires}</wsu:Expires></wsu:Timestamp>
<wsse:UsernameToken wsu:Id="UT-1"><wsse:Username>${esc(user)}</wsse:Username>
<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${b64(digest)}</wsse:Password>
<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${b64(nonce)}</wsse:Nonce>
<wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security>`;
}

const Body = z.object({ codigos: z.array(z.string().regex(/^\d{1,10}$/)).min(1).max(30) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: claims } = await client.auth.getClaims(token);
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return json({ error: 'Unauthorized' }, 401);
  const { data: ok } = await client.rpc('is_adm_master');
  if (!ok) {
    await client.rpc('log_unauthorized_access', { _action: 'soc_empresa_inativar', _details: {} }).then(() => {}, () => {});
    return json({ error: 'Forbidden' }, 403);
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  const user = Deno.env.get('SOC_WS_USUARIO'), senha = Deno.env.get('SOC_WS_CHAVE');
  const resp = Deno.env.get('SOC_WS_CODIGO_RESPONSAVEL'), principal = Deno.env.get('SOC_CODIGO_EMPRESA');
  if (!user || !senha || !resp || !principal) return json({ error: 'Credenciais do Web Service SOC ausentes' }, 500);
  const codUser = user.replace(/^U/i, '');

  const { data: emps } = await admin.from('companies').select('id, soc_code, razao_social, subgrupo_codigo, vidas_ativas').in('soc_code', parsed.data.codigos);
  const resultados: unknown[] = [];
  for (const codigo of parsed.data.codigos) {
    const e = emps?.find((x) => x.soc_code === codigo);
    if (!e) { resultados.push({ codigo, ok: false, erro: 'Empresa não encontrada no portal' }); continue; }
    if (e.subgrupo_codigo !== '0001') { resultados.push({ codigo, ok: false, erro: 'Só inativa subgrupo 0001 (Cancelado)' }); continue; }
    if (Number(e.vidas_ativas ?? 0) > 0) { resultados.push({ codigo, ok: false, erro: `Possui ${e.vidas_ativas} vidas ativas` }); continue; }
    const body = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://services.soc.age.com/">
<soap:Header>${await wssHeader(`U${codUser}`, senha)}</soap:Header>
<soap:Body><ser:alterarEmpresa><AlterarEmpresaWsVo>
<identificacaoWsVo><codigoEmpresaPrincipal>${esc(principal)}</codigoEmpresaPrincipal><codigoResponsavel>${esc(resp)}</codigoResponsavel><codigoUsuario>${esc(codUser)}</codigoUsuario></identificacaoWsVo>
<codigo>${codigo}</codigo><tipoBusca>CODIGO_SOC</tipoBusca><ativo>false</ativo>
</AlterarEmpresaWsVo></ser:alterarEmpresa></soap:Body></soap:Envelope>`;
    let r: { codigo: string; ok: boolean; erro?: string | null; resposta?: string };
    try {
      const h = await fetch(URL_WS, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' }, body, signal: AbortSignal.timeout(20_000) });
      const txt = await h.text();
      const fault = tag(txt, 'faultstring');
      const erroFlag = tag(txt, 'encontrouErro') ?? tag(txt, 'numeroErros');
      const msg = tag(txt, 'descricaoErro') ?? tag(txt, 'mensagemErro') ?? tag(txt, 'mensagem');
      const sucesso = h.ok && !fault && (!erroFlag || erroFlag === 'false' || erroFlag === '0');
      r = { codigo, ok: sucesso, erro: sucesso ? null : (fault ?? msg ?? `HTTP ${h.status}`), resposta: txt.slice(0, 1500) };
    } catch (err) { r = { codigo, ok: false, erro: String(err) }; }
    await admin.from('audit_log').insert({ user_id: uid, action_type: r.ok ? 'soc_empresa_inativada' : 'soc_empresa_inativar_falha', object_type: 'company', object_id: e.id, details: { codigo, razao_social: e.razao_social, erro: r.erro ?? null } });
    resultados.push(r);
  }
  return json({ resultados });
});
