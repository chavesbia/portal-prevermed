// Rotina: exames sem data de resultado da CARTEIRA PRÓPRIA.
// 1) Descoberta: Exporta 209094 (por empresa, últimos 45 dias) lista as fichas abertas no SOC — inclusive as do balcão.
// 2) Verdade: Exporta 220115 (por ficha) devolve todos os exames da Tela 248 com DATARESULTADO.
// Roda em lotes com tempo limitado e cursor salvo, respeitando o limite de 5 chamadas simultâneas do SOC.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';
const TIPO: Record<string, string> = { '1': 'Admissional', '2': 'Periódico', '3': 'Retorno ao Trabalho', '4': 'Mudança de Risco', '5': 'Demissional', '6': 'Monitoração Pontual' };
const CONCORRENCIA = 3; // outras rotinas SOC rodam ao mesmo tempo; teto do SOC é 5
const ORCAMENTO_DESCOBERTA_MS = 55_000;
const ORCAMENTO_TOTAL_MS = 110_000;
const JANELA_DIAS = 45;

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const iso = (d: string) => { const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const fmtBR = (dias: number) => { const d = new Date(Date.now() + dias * 864e5); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function exporta(params: Record<string, string>): Promise<Row[] | null> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(JSON.stringify({ ...params, tipoSaida: 'json' }))}`, { method: 'POST' });
      const t = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer()).trim();
      if (resp.ok) {
        if (!t || /^"?(sem|nenhum) resultado\.?"?$/i.test(t)) return [];
        if (t.startsWith('[') || t.startsWith('{')) { const p = JSON.parse(t); return Array.isArray(p) ? p : (p?.data ?? []); }
      }
    } catch { /* nova tentativa */ }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

async function fila<T>(itens: T[], limiteMs: number, fn: (x: T) => Promise<void>) {
  let i = 0; let feitos = 0;
  await Promise.all(Array.from({ length: CONCORRENCIA }, async () => {
    while (i < itens.length && Date.now() < limiteMs) { const x = itens[i++]; await fn(x); feitos++; }
  }));
  return feitos;
}

type Meta = { seq: string; empresa: string; data: string | null; tipo: string | null; cpf: string | null; nome: string | null; cod: string | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const inicio = Date.now();
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
  const empresaPrincipal = Deno.env.get('SOC_CODIGO_EMPRESA');
  const chaveRealizados = Deno.env.get('SOC_CHAVE_EXPORTA_EXAMES_REALIZADOS');
  const chaveFicha = Deno.env.get('SOC_CHAVE_EXPORTA_PEDIDO_FICHA');
  if (!empresaPrincipal || !chaveRealizados || !chaveFicha) return json({ error: 'Configuração SOC ausente' }, 500);

  // Carteira própria ativa com vidas
  const empresas: { soc_code: string; nome: string }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin.from('companies').select('soc_code,nome_abreviado,razao_social')
      .eq('is_active', true).gt('vidas_ativas', 0).not('soc_code', 'is', null).order('soc_code').range(de, de + 999);
    if (error) return json({ error: 'Falha ao ler carteira' }, 500);
    for (const c of data ?? []) empresas.push({ soc_code: String(c.soc_code), nome: c.razao_social || c.nome_abreviado || '' });
    if (!data || data.length < 1000) break;
  }
  const nomeEmpresa = new Map(empresas.map((e) => [e.soc_code, e.nome]));

  // Fichas próprias já conhecidas
  const conhecidas = new Map<string, { pendente: boolean; verificado: string | null; meta: Meta }>();
  const nomesExame = new Map<string, string>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin.from('soc_exames_pendentes')
      .select('sequencial_ficha,empresa_codigo,data_ficha,tipo_ficha,cpf,funcionario_nome,funcionario_codigo,exame_codigo,exame_nome,data_resultado,resolvido_em,verificado_em')
      .eq('origem', 'propria').range(de, de + 999);
    if (error) return json({ error: 'Falha ao ler exames' }, 500);
    for (const r of data ?? []) {
      if (r.exame_codigo && r.exame_nome && r.exame_nome !== r.exame_codigo) nomesExame.set(r.exame_codigo, r.exame_nome);
      const pend = !r.data_resultado && !r.resolvido_em;
      const atual = conhecidas.get(r.sequencial_ficha);
      conhecidas.set(r.sequencial_ficha, {
        pendente: (atual?.pendente ?? false) || pend,
        verificado: r.verificado_em,
        meta: atual?.meta ?? { seq: r.sequencial_ficha, empresa: r.empresa_codigo ?? '', data: r.data_ficha, tipo: r.tipo_ficha, cpf: r.cpf, nome: r.funcionario_nome, cod: r.funcionario_codigo },
      });
    }
    if (!data || data.length < 1000) break;
  }

  // 1) Descoberta em lote, com cursor
  const { data: est } = await admin.from('soc_sync_estado').select('valor').eq('chave', 'exames_proprios').maybeSingle();
  let cursor = Number((est?.valor as Row | null)?.cursor ?? 0);
  if (!(cursor >= 0 && cursor < empresas.length)) cursor = 0;
  const ordem = [...empresas.slice(cursor), ...empresas.slice(0, cursor)];
  const novas = new Map<string, Meta>();
  let falhasDescoberta = 0;
  const descobertas = await fila(ordem, inicio + ORCAMENTO_DESCOBERTA_MS, async (e) => {
    const linhas = await exporta({ empresa: empresaPrincipal, codigo: '209094', chave: chaveRealizados, empresaTrabalho: e.soc_code, dataInicio: fmtBR(-JANELA_DIAS), dataFim: fmtBR(0) });
    if (!linhas) { falhasDescoberta++; return; }
    for (const r of linhas) {
      const seq = s(r.CODIGOSEQUENCIALFICHA); if (!seq) continue;
      const cod = s(r.CODEXAME); if (cod && s(r.NOMEEXAME)) nomesExame.set(cod, s(r.NOMEEXAME).toUpperCase());
      if (conhecidas.has(seq) || novas.has(seq)) continue;
      novas.set(seq, { seq, empresa: e.soc_code, data: iso(s(r.DATAFICHA)), tipo: TIPO[s(r.TIPOFICHA)] ?? null, cpf: s(r.CPF).replace(/\D/g, '').padStart(11, '0') || null, nome: s(r.NOMEFUNCIONARIO) || null, cod: s(r.CODFUNCIONARIO) || null });
    }
  });
  const novoCursor = empresas.length ? (cursor + descobertas) % empresas.length : 0;
  await admin.from('soc_sync_estado').upsert({ chave: 'exames_proprios', valor: { cursor: novoCursor, total: empresas.length }, atualizado_em: new Date().toISOString() });

  // 2) Leitura por ficha: novas primeiro, depois pendentes verificadas há mais tempo
  const aVerificar: Meta[] = [
    ...novas.values(),
    ...[...conhecidas.values()].filter((c) => c.pendente).sort((a, b) => (a.verificado ?? '').localeCompare(b.verificado ?? '')).map((c) => c.meta),
  ];
  let gravados = 0; let falhasFicha = 0;
  const verificadas = await fila(aVerificar, inicio + ORCAMENTO_TOTAL_MS, async (m) => {
    const linhas = await exporta({ empresa: empresaPrincipal, codigo: '220115', chave: chaveFicha, empresaTrabalho: m.empresa, sequencial: m.seq });
    if (!linhas) { falhasFicha++; return; }
    const agora = new Date().toISOString();
    const ids: string[] = [];
    const rows = linhas.map((r) => {
      const res = s(r.SEQUENCIALRESULTADO); const cod = s(r.CODIGOEXAME);
      const id = `propria:${res || `${m.seq}:${cod}`}`; ids.push(id);
      return {
        id, origem: 'propria', sequencial_ficha: m.seq, data_ficha: iso(s(r.DATAFICHA)) ?? m.data, tipo_ficha: TIPO[s(r.TIPOFICHA)] ?? m.tipo,
        cpf: m.cpf, funcionario_nome: s(r.NOMEFUNCIONARIO) || m.nome, funcionario_codigo: s(r.CODIGOFUNCIONARIO) || m.cod,
        empresa_codigo: m.empresa, empresa_nome: nomeEmpresa.get(m.empresa) ?? null,
        exame_codigo: cod || null, exame_nome: nomesExame.get(cod) ?? cod,
        data_resultado: iso(s(r.DATARESULTADO)), resolvido_em: null, sincronizado_em: agora, verificado_em: agora,
      };
    });
    if (rows.length) {
      const { error } = await admin.from('soc_exames_pendentes').upsert(rows, { onConflict: 'id' });
      if (error) { console.error('upsert', error); falhasFicha++; return; }
      gravados += rows.length;
    }
    // Exame retirado da ficha no SOC deixa de ser pendente
    let q = admin.from('soc_exames_pendentes').update({ resolvido_em: agora, verificado_em: agora })
      .eq('origem', 'propria').eq('sequencial_ficha', m.seq).is('resolvido_em', null);
    if (ids.length) q = q.not('id', 'in', `(${ids.map((i) => `"${i}"`).join(',')})`);
    await q;
  });

  const resumo = { empresas: empresas.length, empresasLidas: descobertas, fichasNovas: novas.size, fichasVerificadas: verificadas, fichasNaFila: aVerificar.length, exames: gravados, falhasDescoberta, falhasFicha, ms: Date.now() - inicio };
  console.log(JSON.stringify({ event: 'soc_exames_proprios_sync', ...resumo }));
  return json(resumo);
});
