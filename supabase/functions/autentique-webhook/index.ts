// Public webhook receiving Autentique events
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Autentique sends: { event: 'signature.accepted'|'document.signed'|..., data: { document: {...}, signature: {...} } }
    const event = payload.event || payload.type;
    const data = payload.data || payload;
    const documentId = data?.document?.id || data?.uuid;
    const signature = data?.signature || data?.signer;

    if (!documentId) {
      return json({ ok: true, ignored: 'no document id', payload });
    }

    const { data: contrato } = await admin
      .from('contract_contratos')
      .select('id, numero_contrato')
      .eq('autentique_document_id', documentId)
      .maybeSingle();

    if (!contrato) {
      return json({ ok: true, ignored: 'contrato not found', documentId });
    }

    // Update signer if provided
    if (signature?.public_id) {
      const isSigned = event?.toLowerCase().includes('sign') || signature.signed_at;
      await admin.from('contract_assinaturas').update({
        status: isSigned ? 'assinado' : 'pendente',
        data_assinatura: signature.signed_at || (isSigned ? new Date().toISOString() : null),
        ip_assinatura: signature.ip || null,
      }).eq('autentique_signer_id', signature.public_id);
    }

    // Recompute contract status
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
      tipo: `autentique_${event || 'event'}`,
      descricao: `Evento Autentique: ${event || 'desconhecido'}${signature?.email ? ` — ${signature.email}` : ''}`,
      detalhes: payload,
    });

    return json({ ok: true });
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
