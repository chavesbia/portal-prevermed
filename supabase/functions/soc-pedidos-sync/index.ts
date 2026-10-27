// Rotina: copia os pedidos SOCNET do SOC para soc_pedidos_socnet, para a Agenda responder sem consultar o SOC a cada CPF.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { varrerPedidosSocnet, pick } from '../_shared/socnetPedidos.ts';

const TIPO: Record<string, string> = { '1': 'Admissional', '2': 'Periódico', '3': 'Retorno ao Trabalho', '4': 'Mudança de Risco', '5': 'Demissional', '6': 'Monitoração Pontual' };
const iso = (d: string | null) => { const m = d?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
  const res = await varrerPedidosSocnet(45, 30);
  if (!res) return json({ error: 'SOC indisponível' }, 502);
  const agora = new Date().toISOString();
  const linhas = res.fichas.map((f) => ({ ...f, sincronizado_em: agora }));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await admin.from('soc_pedidos_socnet').upsert(linhas.slice(i, i + 500), { onConflict: 'sequencial_ficha' });
    if (error) { console.error('upsert', error); return json({ error: 'Falha ao gravar' }, 500); }
  }
  // Mesma varredura alimenta os Exames Pendentes (uma linha por exame; pendente = sem DATARESULTADO)
  const exames = new Map<string, Record<string, unknown>>();
  for (const r of res.linhas) {
    const seq = pick(r, ['SEQUENCIALFICHA']); const exame = pick(r, ['NOMEEXAME']);
    if (!seq || !exame) continue;
    const codExame = pick(r, ['CODIGOEXAME']);
    const id = `socnet:${pick(r, ['SEQUENCIARESULTADOEXAME']) ?? `${seq}:${codExame ?? exame}`}`;
    exames.set(id, {
      id, origem: 'socnet', sequencial_ficha: seq, data_ficha: iso(pick(r, ['DATAFICHA'])), tipo_ficha: TIPO[pick(r, ['TIPOEXAME']) ?? ''] ?? null,
      cpf: (pick(r, ['CPF']) ?? '').replace(/\D/g, '').padStart(11, '0'), funcionario_nome: pick(r, ['NOME']),
      empresa_codigo: pick(r, ['CODIGOEMPRESA']), empresa_nome: pick(r, ['NOMEEMPRESA']), assessoria_nome: pick(r, ['NOMEEMPRESAREPASSE']),
      exame_codigo: codExame, exame_nome: exame.toUpperCase(),
      prestador_codigo: pick(r, ['CODIGOPRESTADORREFERENCIA']), prestador_nome: pick(r, ['NOMEPRESTADORREFERENCIA']),
      data_resultado: iso(pick(r, ['DATARESULTADO'])), sincronizado_em: agora,
    });
  }
  const linhasEx = [...exames.values()];
  for (let i = 0; i < linhasEx.length; i += 500) {
    const { error } = await admin.from('soc_exames_pendentes').upsert(linhasEx.slice(i, i + 500), { onConflict: 'id' });
    if (error) { console.error('upsert exames', error); return json({ error: 'Falha ao gravar exames' }, 500); }
  }
  console.log(JSON.stringify({ event: 'soc_pedidos_sync', exames: linhasEx.length, fichas: linhas.length, diasSemResposta: res.falhas }));
  return json({ fichas: linhas.length, exames: linhasEx.length, diasSemResposta: res.falhas });
});
