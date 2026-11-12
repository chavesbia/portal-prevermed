// Desativado: endpoint de teste temporário (expunha consulta ao SOC sem login).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(JSON.stringify({ error: 'Endpoint desativado' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
