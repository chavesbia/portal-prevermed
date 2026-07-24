// Sincroniza a base mestre de empresas com o SOC (ExportaDados)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function digits(v: unknown): string | null {
  const t = s(v);
  return t ? t.replace(/\D/g, '') || null : null;
}

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
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const startedAt = new Date().toISOString();
    const { data: logRow } = await admin
      .from('companies_sync_log')
      .insert({ started_at: startedAt, triggered_by: userId, status: 'running' })
      .select('id')
      .single();
    const logId = logRow?.id as string | undefined;

    const finalize = async (patch: Record<string, unknown>) => {
      if (!logId) return;
      await admin.from('companies_sync_log').update({ finished_at: new Date().toISOString(), ...patch }).eq('id', logId);
    };

    const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
    const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_DADOS');
    const chave = Deno.env.get('SOC_CHAVE_EXPORTA_DADOS');
    if (!empresa || !codigo || !chave) {
      const msg = 'Credenciais SOC ausentes (SOC_CODIGO_EMPRESA, SOC_CODIGO_EXPORTA_DADOS, SOC_CHAVE_EXPORTA_DADOS)';
      await finalize({ status: 'error', error_message: msg });
      return json({ error: msg }, 500);
    }

    const parametro = JSON.stringify({ empresa, codigo, chave, tipoSaida: 'json' });
    const url = `${SOC_URL}?parametro=${encodeURIComponent(parametro)}`;

    const resp = await fetch(url, { method: 'POST' });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      await finalize({ status: 'error', error_message: `SOC HTTP ${resp.status}: ${detail.slice(0, 500)}` });
      return json({ error: 'Falha ao consultar SOC', status: resp.status, detail }, 502);
    }

    const buf = await resp.arrayBuffer();
    const text = new TextDecoder('iso-8859-1').decode(buf);
    let empresas: any[] = [];
    try {
      const parsed = JSON.parse(text);
      empresas = Array.isArray(parsed) ? parsed : (parsed?.empresas || parsed?.data || []);
    } catch (_e) {
      await finalize({ status: 'error', error_message: 'Resposta SOC não é JSON válido' });
      return json({ error: 'Resposta SOC não é JSON válido', preview: text.slice(0, 500) }, 502);
    }

    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    const errors: any[] = [];
    const skipped: any[] = [];

    // Build rows + dedupe by soc_code; capture skipped rows with reason
    const rowsMap = new Map<string, any>();
    for (const e of empresas) {
      const soc_code = s(e.CODIGO);
      const razao = s(e.RAZAOSOCIAL) || s(e.RAZAOSOCIALINICIAL);
      const cnpj = digits(e.CNPJ);
      if (!soc_code) {
        skipped.push({
          reason: 'sem_codigo',
          motivo: 'Registro do SOC sem código de empresa',
          razao_social: razao,
          cnpj: s(e.CNPJ),
        });
        continue;
      }
      if (!cnpj) {
        // Ainda sincronizamos, mas registramos como "sem CNPJ" (ex.: parceiros SOCNET)
        skipped.push({
          reason: (razao || '').toUpperCase().includes('SOCNET') ? 'socnet_sem_cnpj' : 'sem_cnpj',
          motivo: (razao || '').toUpperCase().includes('SOCNET')
            ? 'Parceiro SOCNET sem CNPJ cadastrado no SOC'
            : 'Empresa sem CNPJ no SOC',
          soc_code,
          razao_social: razao,
        });
      }
      rowsMap.set(soc_code, {
        soc_code,
        cnpj,
        nome_abreviado: s(e.NOMEABREVIADO),
        razao_social: razao || soc_code,
        cep: digits(e.CEP),
        logradouro: s(e.ENDERECO),
        numero: s(e.NUMEROENDERECO),
        complemento: s(e.COMPLEMENTOENDERECO),
        bairro: s(e.BAIRRO),
        cidade: s(e.CIDADE),
        estado: s(e.UF),
        inscricao_estadual: s(e.INSCRICAOESTADUAL),
        inscricao_municipal: s(e.INSCRICAOMUNICIPAL),
        is_active: String(e.ATIVO ?? '').trim() === '1' || String(e.ATIVO ?? '').toUpperCase() === 'SIM' || e.ATIVO === true,
        codigo_cliente_integracao: s(e.CODIGOCLIENTEINTEGRACAO),
        synced_at: now,
      });
    }
    const rows = Array.from(rowsMap.values());
    const codes = rows.map((r) => r.soc_code);

    // Fetch existing soc_codes in batches to classify inserted vs updated
    const existingSet = new Set<string>();
    const CHUNK = 500;
    for (let i = 0; i < codes.length; i += CHUNK) {
      const slice = codes.slice(i, i + CHUNK);
      const { data, error } = await admin.from('companies').select('soc_code').in('soc_code', slice);
      if (error) { errors.push({ error: `select existing: ${error.message}` }); continue; }
      for (const r of data || []) existingSet.add(r.soc_code as string);
    }

    // Bulk upsert in chunks on soc_code
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const { error } = await admin.from('companies').upsert(batch, { onConflict: 'soc_code' });
      if (error) {
        errors.push({ batch: `${i}-${i + batch.length}`, error: error.message });
        continue;
      }
      for (const r of batch) {
        if (existingSet.has(r.soc_code)) updated++; else inserted++;
      }
    }

    const status = errors.length === 0 ? 'success' : (inserted + updated > 0 ? 'partial' : 'error');
    await finalize({
      status,
      total: empresas.length,
      inserted,
      updated,
      error_count: errors.length,
      errors: errors.slice(0, 100),
      skipped: skipped.slice(0, 500),
      skipped_count: skipped.length,
    });


    return json({
      ok: true,
      log_id: logId,
      total: empresas.length,
      inserted,
      updated,
      errors: errors.slice(0, 20),
      error_count: errors.length,
      synced_at: now,
      status,
    });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

