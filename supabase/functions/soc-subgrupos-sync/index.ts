// Subgrupo oficial de toda a carteira própria (Exporta 218427 com socnet=0, inclui inativas).
// Fonte única do subgrupo em `companies` — o relatório de preço só cobre empresas com contrato no financeiro.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Nomes oficiais do SOC; o código é a chave, o nome é só exibição.
const NOMES: Record<string, string> = {
  '0001': 'CANCELADO', '0002': 'PONTUAL - EXAMES', '0003': 'POR USO', '0004': 'PARCEIRAS COM PRONTUARIO',
  '0007': 'POR USO COM ESOCIAL', '0008': 'GESTAO OCUPACIONAL COM ESOCIAL', '0010': 'PARCEIRAS VIA SOCNET', '0011': 'GESTAO OCUPACIONAL',
};
const pick = (r: Record<string, unknown>, ks: string[]) => { for (const k of ks) for (const rk of Object.keys(r)) if (rk.toLowerCase() === k.toLowerCase()) return r[rk]; return undefined; };
const cod4 = (v: unknown) => { const d = String(v ?? '').replace(/\D/g, ''); return d ? d.slice(-4).padStart(4, '0') : null; };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const internal = Deno.env.get('SOC_SYNC_INTERNAL_SECRET');
  if (!(internal && req.headers.get('x-soc-sync-secret') === internal)) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data } = await client.auth.getClaims(token);
    if (!data?.claims) return json({ error: 'Unauthorized' }, 401);
    const { data: ok } = await client.rpc('is_adm_master');
    if (!ok) return json({ error: 'Forbidden' }, 403);
  }

  const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
  const chave = Deno.env.get('SOC_CHAVE_EXPORTA_EMPRESAS_SOCNET');
  if (!empresa || !chave) return json({ error: 'Configuração SOC ausente' }, 500);
  const param = { empresa, codigo: '218427', chave, tipoSaida: 'json', empresafiltro: '', subgrupo: '', socnet: 'Nao', mostrarinativas: 'Sim' };
  const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(JSON.stringify(param))}`, { method: 'POST' });
  const text = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer()).trim();
  let rows: Record<string, unknown>[];
  try { rows = JSON.parse(text); if (!Array.isArray(rows)) throw 0; }
  catch { console.error('SOC 218427 subgrupos', text.slice(0, 300)); return json({ error: 'Resposta inválida do SOC' }, 502); }

  const porCodigo = new Map<string, string>();
  for (const r of rows) {
    const code = String(pick(r, ['codigo', 'codigoEmpresa']) ?? '').trim();
    const sg = cod4(pick(r, ['codigoSubGrupo', 'codigoSubgrupo']));
    if (code && sg) porCodigo.set(code, sg);
  }
  // Proteção: resposta muito pequena indica relatório errado — não sobrescreve a carteira.
  if (porCodigo.size < 100) return json({ error: 'Poucas empresas com subgrupo na resposta; nada gravado', recebidas: rows.length, comSubgrupo: porCodigo.size, campos: Object.keys(rows[0] ?? {}) }, 502);

  const agora = new Date().toISOString();
  const grupos = new Map<string, string[]>();
  for (const [code, sg] of porCodigo) { const a = grupos.get(sg) ?? []; a.push(code); grupos.set(sg, a); }
  let atualizadas = 0; const semNome: string[] = [];
  for (const [sg, codes] of grupos) {
    if (!NOMES[sg]) semNome.push(sg);
    for (let i = 0; i < codes.length; i += 300) {
      const { data, error } = await admin.from('companies')
        .update({ subgrupo_codigo: sg, subgrupo: NOMES[sg] ?? `SUBGRUPO ${sg}`, subgrupo_synced_at: agora })
        .in('soc_code', codes.slice(i, i + 300)).select('id');
      if (error) { console.error('update', error); return json({ error: 'Falha ao gravar' }, 500); }
      atualizadas += data?.length ?? 0;
    }
  }
  const resumo = { recebidas: rows.length, comSubgrupo: porCodigo.size, atualizadas, porSubgrupo: Object.fromEntries([...grupos].map(([k, v]) => [k, v.length])), semNome };
  console.log(JSON.stringify({ event: 'soc_subgrupos_sync', ...resumo }));
  return json(resumo);
});
