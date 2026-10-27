// Carga do catálogo técnico SOCNET (Exporta 218427): CNPJ -> código SOC da empresa parceira.
// Grava SOMENTE em socnet_empresas (isolada da carteira `companies`), usada pela Agenda para achar guias/pedidos.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const internal = Deno.env.get('SOC_SYNC_INTERNAL_SECRET');
  const isInternal = !!internal && req.headers.get('x-soc-sync-secret') === internal;
  if (!isInternal) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data } = await client.auth.getClaims(token);
    if (!data?.claims) return json({ error: 'Unauthorized' }, 401);
    const { data: ok } = await client.rpc('is_adm_master');
    if (!ok) return json({ error: 'Forbidden' }, 403);
  }
  const body = await req.json().catch(() => ({}));

  // A rede muda pouco: a rotina agendada (3x/dia) só recarrega uma vez a cada 20h.
  if (!body?.forcar) {
    const { data: ult } = await admin.from('socnet_empresas').select('sincronizado_em').not('sincronizado_em', 'is', null)
      .order('sincronizado_em', { ascending: false }).limit(1).maybeSingle();
    if (ult?.sincronizado_em && Date.now() - new Date(ult.sincronizado_em).getTime() < 20 * 3600e3) return json({ skipped: true });
  }

  const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
  const chave = Deno.env.get('SOC_CHAVE_EXPORTA_EMPRESAS_SOCNET');
  if (!empresa || !chave) return json({ error: 'Configuração SOC ausente' }, 500);
  const param = { empresa, codigo: '218427', chave, tipoSaida: 'json', empresafiltro: '', subgrupo: '', socnet: 'Sim', mostrarinativas: 'Nao' };
  const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(JSON.stringify(param))}`, { method: 'POST' });
  const text = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer()).trim();
  let rows: Record<string, string>[];
  try { rows = JSON.parse(text); if (!Array.isArray(rows)) throw 0; }
  catch { console.error('SOC 218427', text.slice(0, 300)); return json({ error: 'Resposta inválida do SOC' }, 502); }

  const agora = new Date().toISOString();
  const porCnpj = new Map<string, { cnpj: string; soc_code: string; razao_social: string; ativo: boolean; sincronizado_em: string }>();
  for (const r of rows) {
    const cnpj = String(r.cnpj ?? '').replace(/\D/g, '');
    const code = String(r.codigo ?? '').trim();
    if (cnpj.length !== 14 || !code) continue;
    const ativo = String(r.status) === 'true';
    const atual = porCnpj.get(cnpj);
    if (atual && (atual.ativo || !ativo)) continue; // mesmo CNPJ em mais de um código: prefere o ativo
    porCnpj.set(cnpj, { cnpj, soc_code: code, razao_social: String(r.razaoSocial || r.nome || '').trim().toUpperCase(), ativo, sincronizado_em: agora });
  }
  const lista = [...porCnpj.values()];
  for (let i = 0; i < lista.length; i += 1000) {
    const { error } = await admin.from('socnet_empresas').upsert(lista.slice(i, i + 1000), { onConflict: 'cnpj' });
    if (error) { console.error('upsert', error); return json({ error: 'Falha ao gravar' }, 500); }
  }
  console.log(JSON.stringify({ event: 'socnet_empresas_sync', recebidas: rows.length, gravadas: lista.length }));
  return json({ recebidas: rows.length, gravadas: lista.length });
});
