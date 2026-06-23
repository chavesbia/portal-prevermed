import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.cnpj || '').replace(/\D/g, '');
    if (raw.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: 'CNPJ não encontrado', detail: text }), {
        status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const data = await resp.json();

    const mapped = {
      cnpj: raw,
      razao_social: data.razao_social || data.nome_empresarial || '',
      nome_fantasia: data.nome_fantasia || '',
      cep: (data.cep || '').toString().replace(/\D/g, ''),
      logradouro: data.logradouro || '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.municipio || '',
      estado: data.uf || '',
      situacao_cadastral: data.descricao_situacao_cadastral || '',
      cnae_principal: data.cnae_fiscal_descricao
        ? `${data.cnae_fiscal || ''} - ${data.cnae_fiscal_descricao}`
        : (data.cnae_fiscal || '').toString(),
      email: data.email || '',
      telefone: [data.ddd_telefone_1, data.ddd_telefone_2].filter(Boolean).join(' / '),
    };

    return new Response(JSON.stringify({ data: mapped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
