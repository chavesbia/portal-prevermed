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
    if (!contrato_id) return json({ error: 'contrato_id é obrigatório' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: contrato, error: cErr } = await admin
      .from('contract_contratos')
      .select('autentique_document_id')
      .eq('id', contrato_id)
      .maybeSingle();

    if (cErr || !contrato) return json({ error: 'Contrato não encontrado' }, 404);
    
    const docId = contrato.autentique_document_id;
    if (!docId) return json({ error: 'Contrato não possui ID do Autentique' }, 400);

    const apiToken = Deno.env.get('AUTENTIQUE_API_TOKEN');
    if (!apiToken) return json({ error: 'AUTENTIQUE_API_TOKEN ausente' }, 500);

    // Mutation para editar documento e definir deadline_at para agora (bloqueio)
    const mutation = `mutation UpdateDocument($id: UUID!, $document: UpdateDocumentInput!) {
      updateDocument(id: $id, document: $document) {
        id
        name
      }
    }`;

    // Deadline para o momento atual (bloqueio imediato)
    const deadline = new Date().toISOString();

    console.log(`Bloqueando documento ${docId} definindo deadline para ${deadline}`);
    const resp = await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: mutation, 
        variables: { 
          id: docId, 
          document: { 
            deadline_at: deadline
          } 
        } 
      }),
    });
    
    const result = await resp.json();
    
    if (!resp.ok || result.errors) {
      console.error('Erro Autentique UpdateDocument (Lock):', JSON.stringify(result.errors));
      return json({ error: 'Erro ao bloquear documento no Autentique', details: result }, 502);
    }

    return json({ ok: true });

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
