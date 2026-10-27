// Rotina: copia a Tela 245 (Prestadores) do SOC via Exporta 218830 para soc_prestadores.
// Nunca sobrescreve unidade_responsavel (classificação feita no portal).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const s = (v: unknown) => { const t = String(v ?? '').trim(); return t || null; };
const DIAS: [string, string][] = [['diaSemanaSegunda', 'seg'], ['diaSemanaTerca', 'ter'], ['diaSemanaQuarta', 'qua'], ['diaSemanaQuinta', 'qui'], ['diaSemanaSexta', 'sex'], ['diaSemanaSabado', 'sab'], ['diaSemanaDomingo', 'dom']];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const internal = Deno.env.get('SOC_SYNC_INTERNAL_SECRET');
  if (!internal || req.headers.get('x-soc-sync-secret') !== internal) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data } = await client.auth.getClaims(token);
    if (!data?.claims) return json({ error: 'Unauthorized' }, 401);
    const { data: ok } = await client.rpc('is_adm_master');
    if (!ok) return json({ error: 'Forbidden' }, 403);
  }
  const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
  const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_PRESTADORES');
  const chave = Deno.env.get('SOC_CHAVE_EXPORTA_PRESTADORES');
  if (!empresa || !codigo || !chave) return json({ error: 'Integração não configurada' }, 500);

  let rows: Record<string, unknown>[];
  try {
    const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(JSON.stringify({ empresa, codigo, chave, tipoSaida: 'json' }))}`, { method: 'POST' });
    const t = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer()).trim();
    if (!resp.ok) return json({ error: 'SOC indisponível' }, 502);
    const p = JSON.parse(t); rows = Array.isArray(p) ? p : [];
  } catch (e) { console.error('soc', e); return json({ error: 'SOC indisponível' }, 502); }
  if (!rows.length) return json({ error: 'SOC não devolveu prestadores' }, 502);

  const agora = new Date().toISOString();
  const linhas = rows.filter((r) => s(r.codigoPrestador)).map((r) => {
    const end = [s(r.endereco), s(r.numeroEndereco), s(r.complementoEndereco)].filter(Boolean).join(', ');
    const ini = s(r.horarioAtendimentoInicial), fim = s(r.horarioAtendimentoFinal);
    return {
      codigo: String(r.codigoPrestador).trim(),
      nome: (s(r.nomePrestador) ?? '').toUpperCase(),
      razao_social: s(r.razaoSocial)?.toUpperCase() ?? null,
      cnpj: s(r.cnpj),
      cidade: s(r.cidade)?.toUpperCase() ?? null,
      uf: s(r.estado)?.toUpperCase() ?? null,
      endereco: [end, s(r.bairro), s(r.cep)].filter(Boolean).join(' - ') || null,
      telefone: s(r.telefone), celular: s(r.celular), email: s(r.email)?.toLowerCase() ?? null,
      tipo_atendimento: s(r.tipoAtendimento),
      horario: ini && fim ? `${ini} às ${fim}` : null,
      dias_atendimento: DIAS.filter(([k]) => s(r[k]) === 'Sim').map(([, d]) => d),
      socnet: String(r.socnet ?? '').toLowerCase().startsWith('s'),
      ativo: String(r.situacao ?? '') === 'Sim',
      data_cancelamento: s(r.dataCancelamento),
      sincronizado_em: agora,
    };
  });
  const { error } = await admin.from('soc_prestadores').upsert(linhas, { onConflict: 'codigo' });
  if (error) { console.error('upsert', error); return json({ error: 'Falha ao gravar' }, 500); }
  console.log(JSON.stringify({ event: 'soc_prestadores_sync', prestadores: linhas.length }));
  return json({ prestadores: linhas.length });
});
