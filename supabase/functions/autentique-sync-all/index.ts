// Batch sync: pulls Autentique status for all contracts with pending signatures
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const AUTENTIQUE_URL = 'https://api.autentique.com.br/v2/graphql';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const apiToken = Deno.env.get('AUTENTIQUE_API_TOKEN');
    if (!apiToken) return json({ error: 'AUTENTIQUE_API_TOKEN ausente' }, 500);

    const { data: contratos } = await admin
      .from('contract_contratos')
      .select('id, autentique_document_id, status, assinaturas:contract_assinaturas(*)')
      .not('autentique_document_id', 'is', null)
      .in('status', ['aguardando_assinatura', 'parcialmente_assinado']);

    const results: any[] = [];
    for (const contrato of contratos || []) {
      try {
        const query = `query GetDoc($id: UUID!) {
          document(id: $id) {
            id
            signatures {
              public_id email
              signed { created_at ip }
              rejected { created_at ip }
            }
          }
        }`;
        const resp = await fetch(AUTENTIQUE_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { id: contrato.autentique_document_id } }),
        });
        const respJson = await resp.json();
        const doc = respJson.data?.document;
        if (!doc) { results.push({ id: contrato.id, skipped: true }); continue; }

        let changed = 0;
        for (const sig of doc.signatures || []) {
          const match = (contrato.assinaturas || []).find(
            (a: any) =>
              a.autentique_signer_id === sig.public_id ||
              a.email?.toLowerCase() === sig.email?.toLowerCase(),
          );
          if (!match) continue;
          const signed = sig.signed?.created_at;
          const rejected = sig.rejected?.created_at;
          const newStatus = signed ? 'assinado' : rejected ? 'rejeitado' : 'pendente';
          if (newStatus === match.status && match.autentique_signer_id === sig.public_id) continue;
          await admin.from('contract_assinaturas').update({
            autentique_signer_id: sig.public_id,
            status: newStatus,
            data_assinatura: signed || null,
            ip_assinatura: sig.signed?.ip || sig.rejected?.ip || null,
          }).eq('id', match.id);
          changed++;
        }

        const { data: assinaturas } = await admin
          .from('contract_assinaturas')
          .select('status')
          .eq('contrato_id', contrato.id);
        const total = assinaturas?.length || 0;
        const assinadas = (assinaturas || []).filter((a) => a.status === 'assinado').length;
        let novoStatus: string | null = null;
        if (total > 0 && assinadas === total) novoStatus = 'ativo';
        else if (assinadas > 0) novoStatus = 'parcialmente_assinado';
        if (novoStatus && novoStatus !== contrato.status) {
          await admin.from('contract_contratos').update({ status: novoStatus }).eq('id', contrato.id);
        }

        if (changed > 0) {
          await admin.from('contract_eventos').insert({
            contrato_id: contrato.id,
            tipo: 'autentique_sync_auto',
            descricao: `Sincronização automática: ${assinadas}/${total} assinaturas`,
            detalhes: { changed, signatures: doc.signatures },
          });
        }

        results.push({ id: contrato.id, changed, total, assinadas, status: novoStatus });
      } catch (e) {
        results.push({ id: contrato.id, error: String((e as any)?.message || e) });
      }
    }

    return json({ ok: true, processed: results.length, results });
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
