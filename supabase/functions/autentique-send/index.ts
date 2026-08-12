// Send contract PDF to Autentique for electronic signature
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const AUTENTIQUE_URL = 'https://api.autentique.com.br/v2/graphql';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
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

    const { data: contrato, error: cErr } = await admin
      .from('contract_contratos')
      .select('*, cliente:contract_clientes(*), assinaturas:contract_assinaturas(*)')
      .eq('id', contrato_id)
      .maybeSingle();
    if (cErr || !contrato) return json({ error: 'Contrato não encontrado' }, 404);
    if (!contrato.pdf_url) return json({ error: 'Gere o PDF antes de enviar' }, 400);

    // Download PDF from storage
    const { data: pdfBlob, error: dlErr } = await admin.storage
      .from('contract-pdfs')
      .download(contrato.pdf_url);
    if (dlErr || !pdfBlob) return json({ error: 'PDF não encontrado no storage' }, 500);

    // Fallback: se não há linhas em contract_assinaturas, cria a partir dos campos do contrato
    let assinaturas = contrato.assinaturas || [];
    if (assinaturas.length === 0) {
      const candidatos = [
        { tipo: 'contratada', nome: contrato.prevermed_nome, cpf: contrato.prevermed_cpf, email: contrato.prevermed_email },
        { tipo: 'representante', nome: contrato.rep_nome, cpf: contrato.rep_cpf, email: contrato.rep_email },
        { tipo: 'testemunha_1', nome: contrato.testemunha1_nome, cpf: contrato.testemunha1_cpf, email: contrato.testemunha1_email },
        { tipo: 'testemunha_2', nome: contrato.testemunha2_nome, cpf: contrato.testemunha2_cpf, email: contrato.testemunha2_email },
      ].filter((c) => c.nome && c.email)
       .map((c) => ({ ...c, contrato_id, nome: String(c.nome).trim(), email: String(c.email).trim(), status: 'pendente' }));

      if (candidatos.length > 0) {
        const { data: inseridas, error: insErr } = await admin
          .from('contract_assinaturas').insert(candidatos).select('*');
        if (insErr) return json({ error: `Erro ao criar signatários: ${insErr.message}` }, 500);
        assinaturas = inseridas || [];
      }
    }

    const signers = assinaturas
      .filter((a: any) => a.email)
      .map((a: any) => ({ email: a.email, action: 'SIGN', name: a.nome }));
    if (signers.length === 0) {
      return json({ error: 'Nenhum signatário com e-mail cadastrado. Edite o contrato e informe os e-mails dos signatários.' }, 400);
    }


    const apiToken = Deno.env.get('AUTENTIQUE_API_TOKEN');
    if (!apiToken) return json({ error: 'AUTENTIQUE_API_TOKEN ausente' }, 500);

    const mutation = `mutation CreateDocumentMutation(
      $document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!
    ) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id name signatures { public_id name email action { name } link { short_link } }
      }
    }`;

    const operations = {
      query: mutation,
      variables: {
        document: { name: `Contrato ${contrato.numero_contrato}` },
        signers,
        file: null,
      },
    };
    const map = { '0': ['variables.file'] };

    const formData = new FormData();
    formData.append('operations', JSON.stringify(operations));
    formData.append('map', JSON.stringify(map));
    formData.append('0', pdfBlob, `${contrato.numero_contrato}.pdf`);

    const resp = await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    });
    const respJson = await resp.json();

    if (!resp.ok || respJson.errors) {
      const isCreditsError = respJson.errors?.some((e: any) => e.message === 'unavailable_credits');
      if (isCreditsError) {
        return json({ 
          error: 'Créditos insuficientes no Autentique. Por favor, verifique o saldo da conta da empresa.' 
        }, 400);
      }
      return json({ error: 'Autentique error', details: respJson }, 502);
    }

    const doc = respJson.data?.createDocument;
    if (!doc?.id) return json({ error: 'Resposta inválida da Autentique', details: respJson }, 502);

    await admin.from('contract_contratos').update({
      autentique_document_id: doc.id,
      status: 'aguardando_assinatura',
    }).eq('id', contrato_id);

    // Map signers by email -> autentique signer public_id
    for (const sig of doc.signatures || []) {
      const match = assinaturas.find(
        (a: any) => a.email?.toLowerCase() === sig.email?.toLowerCase(),
      );
      if (match) {
        await admin.from('contract_assinaturas').update({
          autentique_signer_id: sig.public_id,
          status: 'pendente',
        }).eq('id', match.id);
      }
    }

    await admin.from('contract_eventos').insert({
      contrato_id,
      tipo: 'autentique_enviado',
      descricao: `Contrato enviado para assinatura (${signers.length} signatários)`,
      detalhes: { autentique_document_id: doc.id },
      performed_by: claims.claims.sub,
    });

    return json({ ok: true, document_id: doc.id, signatures: doc.signatures });
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
