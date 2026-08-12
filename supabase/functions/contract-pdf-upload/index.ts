// Upload de PDF contratual via backend para evitar falhas do Storage no navegador
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (claimsErr || !userId) return json({ error: 'Unauthorized' }, 401);

    const { contrato_id, numero_contrato, pdf_base64 } = await req.json();
    if (!contrato_id || !numero_contrato || !pdf_base64) {
      return json({ error: 'Dados do PDF incompletos' }, 400);
    }

    const { data: isMaster, error: masterErr } = await supabase.rpc('is_adm_master');
    const { data: canEdit, error: editErr } = await supabase.rpc('can_edit_module_route', {
      _user_id: userId,
      _route: '/gestao-contratual',
    });
    if (masterErr || editErr || (!isMaster && !canEdit)) {
      return json({ error: 'Você não tem permissão para gerar PDF deste contrato' }, 403);
    }

    const safeNumber = String(numero_contrato).replace(/[^A-Za-z0-9._-]/g, '-');
    const path = `${contrato_id}/${safeNumber}.pdf`;
    const cleanBase64 = String(pdf_base64).replace(/^data:application\/pdf;base64,/, '');
    const bytes = Uint8Array.from(atob(cleanBase64), (char) => char.charCodeAt(0));

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: uploadErr } = await admin.storage.from('contract-pdfs').upload(path, bytes, {
      upsert: true,
      contentType: 'application/pdf',
    });
    if (uploadErr) return json({ error: uploadErr.message }, 500);

    return json({ path });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}