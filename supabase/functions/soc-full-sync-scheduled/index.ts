import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINTS = [
  'soc-empresas-sync',
  'soc-unidades-sync',
  'soc-contatos-sync',
  'soc-preco-sync',
  'soc-responsaveis-pcmso-sync',
] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const internalSecret = Deno.env.get('SOC_SYNC_INTERNAL_SECRET');

  if (!anonKey || !serviceRoleKey || !supabaseUrl || !internalSecret) {
    return json({ error: 'Configuração interna indisponível' }, 500);
  }

  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
  let authorized = token === anonKey;

  if (!authorized && token) {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getClaims(token);
    authorized = !error && Boolean(data?.claims);
  }

  if (!authorized) return json({ error: 'Unauthorized' }, 401);

  const run = Promise.allSettled(
    ENDPOINTS.map(async (endpoint) => {
      const startedAt = new Date().toISOString();
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'x-soc-sync-secret': internalSecret,
          },
          body: JSON.stringify({ scheduled: true, triggered_at: startedAt }),
        });
        const responseText = await response.text();
        console.log(JSON.stringify({
          event: 'soc_scheduled_sync_result',
          endpoint,
          ok: response.ok,
          status: response.status,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          response: responseText.slice(0, 1000),
        }));
      } catch (error) {
        console.error(JSON.stringify({
          event: 'soc_scheduled_sync_result',
          endpoint,
          ok: false,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }),
  );

  EdgeRuntime.waitUntil(run);

  return json({
    accepted: true,
    endpoints: ENDPOINTS,
    triggered_at: new Date().toISOString(),
  }, 202);
});