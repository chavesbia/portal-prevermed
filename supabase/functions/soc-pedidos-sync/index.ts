// Rotina: copia os pedidos SOCNET do SOC para soc_pedidos_socnet, para a Agenda responder sem consultar o SOC a cada CPF.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { varrerPedidosSocnet } from '../_shared/socnetPedidos.ts';

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
  const res = await varrerPedidosSocnet(15, 30);
  if (!res) return json({ error: 'SOC indisponível' }, 502);
  const agora = new Date().toISOString();
  const linhas = res.fichas.map((f) => ({ ...f, sincronizado_em: agora }));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await admin.from('soc_pedidos_socnet').upsert(linhas.slice(i, i + 500), { onConflict: 'sequencial_ficha' });
    if (error) { console.error('upsert', error); return json({ error: 'Falha ao gravar' }, 500); }
  }
  console.log(JSON.stringify({ event: 'soc_pedidos_sync', fichas: linhas.length, diasSemResposta: res.falhas }));
  return json({ fichas: linhas.length, diasSemResposta: res.falhas });
});
