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
      .eq('status', 'pendente');
    if (assinatura_id) q = q.eq('id', assinatura_id);
    else q = q.eq('contrato_id', contrato_id);

    const { data: assinaturas, error: aErr } = await q;
    if (aErr) return json({ error: aErr.message }, 500);
    if (!assinaturas?.length) return json({ error: 'Nenhum signatário pendente para reenvio' }, 404);

    const apiToken = Deno.env.get('AUTENTIQUE_API_TOKEN');
    if (!apiToken) return json({ error: 'AUTENTIQUE_API_TOKEN ausente' }, 500);

    const resolved: any[] = [];
    const atualizados: any[] = [];
    const naoEncontrados: any[] = [];

    for (const assinatura of assinaturas) {
      if (assinatura.autentique_signer_id) {
        resolved.push(assinatura);
        continue;
      }

      const { data: contrato, error: contratoErr } = await admin
        .from('contract_contratos')
        .select('id, autentique_document_id')
        .eq('id', assinatura.contrato_id)
        .maybeSingle();
      if (contratoErr || !contrato?.autentique_document_id) {
        naoEncontrados.push(assinatura.nome);
        continue;
      }

      const docQuery = `query GetDoc($id: UUID!) {
        document(id: $id) {
          signatures {
            public_id name email
            signed { created_at ip }
            rejected { created_at ip }
            action { name }
          }
        }
      }`;
      const docResp = await fetch(AUTENTIQUE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: docQuery, variables: { id: contrato.autentique_document_id } }),
      });
      const docJson = await docResp.json();
      if (!docResp.ok || docJson.errors) return json({ error: 'Autentique error', details: docJson }, 502);

      const email = assinatura.email?.toLowerCase();
      const signatures = docJson.data?.document?.signatures || [];
      const pendingMatch = signatures.find((sig: any) =>
        sig.email?.toLowerCase() === email &&
        sig.action?.name === 'SIGN' &&
        !sig.signed?.created_at &&
        !sig.rejected?.created_at &&
        !resolved.some((a) => a.autentique_signer_id === sig.public_id),
      );

      if (pendingMatch) {
        await admin.from('contract_assinaturas').update({
          autentique_signer_id: pendingMatch.public_id,
        }).eq('id', assinatura.id);
        resolved.push({ ...assinatura, autentique_signer_id: pendingMatch.public_id });
        continue;
      }

      const signedMatch = signatures.find((sig: any) =>
        sig.email?.toLowerCase() === email && sig.action?.name === 'SIGN' && sig.signed?.created_at,
      );
      if (signedMatch) {
        await admin.from('contract_assinaturas').update({
          autentique_signer_id: signedMatch.public_id,
          status: 'assinado',
          data_assinatura: signedMatch.signed.created_at,
          ip_assinatura: signedMatch.signed.ip || null,
        }).eq('id', assinatura.id);
        atualizados.push(assinatura.nome);
        continue;
      }

      naoEncontrados.push(assinatura.nome);
    }

    const publicIds = resolved.map((a) => a.autentique_signer_id).filter(Boolean);
    if (!publicIds.length) {
      if (atualizados.length) {
        return json({ ok: true, reenviados: 0, atualizados, message: 'Assinatura já constava como assinada no Autentique.' });
      }
      return json({ error: 'Nenhum signatário pendente encontrado no Autentique para reenvio', nao_encontrados: naoEncontrados }, 404);
    }

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

    const contratoIdFinal = resolved[0].contrato_id;
    const nomes = resolved.map((a) => a.nome).join(', ');
    await admin.from('contract_eventos').insert({
      contrato_id: contratoIdFinal,
      tipo: 'autentique_reenviado',
      descricao: `E-mail de assinatura reenviado para: ${nomes}`,
      detalhes: { public_ids: publicIds, atualizados, nao_encontrados: naoEncontrados },
      performed_by: claims.claims.sub,
    });

    return json({ ok: true, reenviados: resolved.length, signatarios: resolved.map((a) => a.nome), atualizados, nao_encontrados: naoEncontrados });
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
