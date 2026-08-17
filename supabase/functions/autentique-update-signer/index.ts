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

    const { assinatura_id, novo_nome, novo_email } = await req.json();
    if (!assinatura_id || !novo_nome || !novo_email) {
      return json({ error: 'assinatura_id, novo_nome e novo_email são obrigatórios' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: assinatura, error: aErr } = await admin
      .from('contract_assinaturas')
      .select('*, contrato:contract_contratos(autentique_document_id)')
      .eq('id', assinatura_id)
      .maybeSingle();

    if (aErr || !assinatura) return json({ error: 'Assinatura não encontrada' }, 404);
    
    const docId = assinatura.contrato?.autentique_document_id;
    const oldSignerId = assinatura.autentique_signer_id;

    if (!docId) {
      return json({ error: 'Contrato não enviado ao Autentique ainda' }, 400);
    }

    const apiToken = Deno.env.get('AUTENTIQUE_API_TOKEN');
    if (!apiToken) return json({ error: 'AUTENTIQUE_API_TOKEN ausente' }, 500);

    // 1. Remover signatário antigo (se existir no Autentique)
    if (oldSignerId) {
      const removeMutation = `mutation RemoveSigner($documentId: UUID!, $signerId: UUID!) {
        removeSigner(documentId: $documentId, signerId: $signerId)
      }`;

      console.log(`Removendo signatário ${oldSignerId} do documento ${docId}`);
      const removeResp = await fetch(AUTENTIQUE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: removeMutation, 
          variables: { documentId: docId, signerId: oldSignerId } 
        }),
      });
      const removeJson = await removeResp.json();
      console.log('Autentique removeSigner response:', JSON.stringify(removeJson));
    }

    // 2. Adicionar novo signatário
    const addMutation = `mutation AddSigner($documentId: UUID!, $signer: SignerInput!) {
      addSigner(documentId: $documentId, signer: $signer) {
        public_id
        name
        email
      }
    }`;

    console.log(`Adicionando signatário ${novo_email} ao documento ${docId}`);
    const addResp = await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: addMutation, 
        variables: { 
          documentId: docId, 
          signer: { 
            email: novo_email, 
            name: novo_nome, 
            action: 'SIGN' 
          } 
        } 
      }),
    });
    const addJson = await addResp.json();
    
    if (!addResp.ok || addJson.errors) {
      console.error('Erro Autentique AddSigner:', JSON.stringify(addJson.errors));
      return json({ error: 'Erro ao adicionar signatário no Autentique', details: addJson }, 502);
    }

    const newSigner = addJson.data?.addSigner;
    if (!newSigner?.public_id) {
      return json({ error: 'Resposta inválida do Autentique ao adicionar signatário' }, 502);
    }

    console.log(`Novo signatário adicionado com ID: ${newSigner.public_id}`);

    // 3. Atualizar banco local com o novo public_id e os novos dados
    const { error: updErr } = await admin.from('contract_assinaturas').update({
      autentique_signer_id: newSigner.public_id,
      email: novo_email,
      nome: novo_nome,
      status: 'pendente'
    }).eq('id', assinatura_id);

    if (updErr) {
      console.error('Erro ao atualizar contract_assinaturas localmente:', updErr);
    }

    // 4. Log do evento
    await admin.from('contract_eventos').insert({
      contrato_id: assinatura.contrato_id,
      tipo: 'autentique_signer_updated',
      descricao: `Signatário atualizado no Autentique: ${novo_email}`,
      detalhes: { 
        old_signer_id: oldSignerId, 
        new_signer_id: newSigner.public_id,
        email: novo_email
      },
      performed_by: claims.claims.sub,
    });

    return json({ ok: true, new_signer_id: newSigner.public_id });

  } catch (e) {
    console.error('Erro capturado na function:', e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
