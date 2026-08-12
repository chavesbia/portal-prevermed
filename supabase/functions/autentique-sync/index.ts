// Pull document status from Autentique on demand
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

    const { contrato_id } = await req.json();
    if (!contrato_id) return json({ error: 'contrato_id required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: contrato } = await admin
      .from('contract_contratos')
      .select('id, autentique_document_id, assinaturas:contract_assinaturas(*)')
      .eq('id', contrato_id)
      .maybeSingle();
    if (!contrato) return json({ error: 'Contrato não encontrado' }, 404);
    if (!contrato.autentique_document_id) return json({ error: 'Contrato sem documento no Autentique' }, 400);

    const apiToken = Deno.env.get('AUTENTIQUE_API_TOKEN');
    if (!apiToken) return json({ error: 'AUTENTIQUE_API_TOKEN ausente' }, 500);

    const query = `query GetDoc($id: UUID!) {
      document(id: $id) {
        id name
        signatures {
          public_id name email
          viewed { created_at ip }
          signed { created_at ip }
          rejected { created_at ip }
          action { name }
          email_events { sent opened delivered refused reason }
        }
      }
    }`;

    const resp = await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: contrato.autentique_document_id } }),
    });
    const respJson = await resp.json();
    if (!resp.ok || respJson.errors) return json({ error: 'Autentique error', details: respJson }, 502);

    const doc = respJson.data?.document;
    if (!doc) return json({ error: 'Documento não encontrado no Autentique' }, 404);

    let updated = 0;
    const usedAssinaturaIds = new Set<string>();
    for (const sig of doc.signatures || []) {
      // 1) match by stored signer_id, 2) fallback: first unused row with same email
      let match = (contrato.assinaturas || []).find(
        (a: any) => a.autentique_signer_id === sig.public_id && !usedAssinaturaIds.has(a.id),
      );
      if (!match) {
        match = (contrato.assinaturas || []).find(
          (a: any) =>
            !usedAssinaturaIds.has(a.id) &&
            !a.autentique_signer_id &&
            a.email?.toLowerCase() === sig.email?.toLowerCase(),
        );
      }
      if (!match) continue;
      usedAssinaturaIds.add(match.id);
      const signed = sig.signed?.created_at;
      const rejected = sig.rejected?.created_at;
      const newStatus = signed ? 'assinado' : rejected ? 'rejeitado' : 'pendente';
      await admin.from('contract_assinaturas').update({
        autentique_signer_id: sig.public_id,
        status: newStatus,
        data_assinatura: signed || null,
        ip_assinatura: sig.signed?.ip || sig.rejected?.ip || null,
      }).eq('id', match.id);
      updated++;
    }


    // Recalcula status do contrato
    const { data: assinaturas } = await admin
      .from('contract_assinaturas')
      .select('status')
      .eq('contrato_id', contrato.id);
    const total = assinaturas?.length || 0;
    const assinadas = (assinaturas || []).filter((a) => a.status === 'assinado').length;
    let novoStatus: string | null = null;
    if (total > 0 && assinadas === total) novoStatus = 'ativo';
    else if (assinadas > 0) novoStatus = 'parcialmente_assinado';
    if (novoStatus) {
      await admin.from('contract_contratos').update({ status: novoStatus }).eq('id', contrato.id);
    }

    await admin.from('contract_eventos').insert({
      contrato_id: contrato.id,
      tipo: 'autentique_sync',
      descricao: `Sincronização manual: ${assinadas}/${total} assinaturas`,
      detalhes: { signatures: doc.signatures },
      performed_by: claims.claims.sub,
    });

    return json({ ok: true, updated, total, assinadas, status: novoStatus });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
