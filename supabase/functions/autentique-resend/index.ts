// Resend signature email via Autentique
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const AUTENTIQUE_URL = 'https://api.autentique.com.br/v2/graphql';

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
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);

    const { assinatura_id, contrato_id } = await req.json();
    if (!assinatura_id && !contrato_id) {
      return json({ error: 'assinatura_id ou contrato_id obrigatório' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let q = admin.from('contract_assinaturas')
      .select('id, nome, email, status, autentique_signer_id, contrato_id')
      .eq('status', 'pendente')
      .not('autentique_signer_id', 'is', null);
    if (assinatura_id) q = q.eq('id', assinatura_id);
    else q = q.eq('contrato_id', contrato_id);

    const { data: assinaturas, error: aErr } = await q;
    if (aErr) return json({ error: aErr.message }, 500);
    if (!assinaturas?.length) return json({ error: 'Nenhum signatário pendente para reenvio' }, 404);

    const publicIds = assinaturas.map((a) => a.autentique_signer_id);

    const apiToken = Deno.env.get('AUTENTIQUE_API_TOKEN');
    if (!apiToken) return json({ error: 'AUTENTIQUE_API_TOKEN ausente' }, 500);

    const mutation = `mutation ResendSignatures($public_ids: [UUID!]!) {
      resendSignatures(public_ids: $public_ids)
    }`;

    const resp = await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables: { public_ids: publicIds } }),
    });
    const respJson = await resp.json();
    if (!resp.ok || respJson.errors) {
      return json({ error: 'Autentique error', details: respJson }, 502);
    }

    const contratoIdFinal = assinaturas[0].contrato_id;
    const nomes = assinaturas.map((a) => a.nome).join(', ');
    await admin.from('contract_eventos').insert({
      contrato_id: contratoIdFinal,
      tipo: 'autentique_reenviado',
      descricao: `E-mail de assinatura reenviado para: ${nomes}`,
      detalhes: { public_ids: publicIds },
      performed_by: claims.claims.sub,
    });

    return json({ ok: true, reenviados: assinaturas.length, signatarios: assinaturas.map((a) => a.nome) });
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
