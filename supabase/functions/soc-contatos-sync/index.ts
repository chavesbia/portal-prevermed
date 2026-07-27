// Sincroniza contatos das empresas com o SOC (ExportaDados — Contatos das Empresas)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let finalize: (patch: Record<string, unknown>) => Promise<void> = async () => {};

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Histórico unificado de sincronizações
    const startedAt = new Date().toISOString();
    const { data: logRow } = await admin
      .from('companies_sync_log')
      .insert({
        sync_type: 'contatos',
        started_at: startedAt,
        status: 'running',
        triggered_by: (claims?.claims as any)?.sub ?? null,
      })
      .select('id')
      .single();
    const logId = logRow?.id as string | undefined;
    finalize = async (patch: Record<string, unknown>) => {
      if (!logId) return;
      await admin
        .from('companies_sync_log')
        .update({ finished_at: new Date().toISOString(), ...patch })
        .eq('id', logId);
    };

    const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
    const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_DADOS_CONTATOS');
    const chave = Deno.env.get('SOC_CHAVE_EXPORTA_DADOS_CONTATOS');
    if (!empresa || !codigo || !chave) {
      return json({
        error: 'Credenciais SOC ausentes (SOC_CODIGO_EMPRESA, SOC_CODIGO_EXPORTA_DADOS_CONTATOS, SOC_CHAVE_EXPORTA_DADOS_CONTATOS)',
      }, 500);
    }

    const parametro = JSON.stringify({ empresa, codigo, chave, tipoSaida: 'json' });
    const url = `${SOC_URL}?parametro=${encodeURIComponent(parametro)}`;

    const resp = await fetch(url, { method: 'POST' });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return json({ error: 'Falha ao consultar SOC', status: resp.status, detail: detail.slice(0, 500) }, 502);
    }

    const buf = await resp.arrayBuffer();
    const text = new TextDecoder('iso-8859-1').decode(buf);
    let contatos: any[] = [];
    try {
      const parsed = JSON.parse(text);
      contatos = Array.isArray(parsed) ? parsed : (parsed?.contatos || parsed?.data || []);
    } catch {
      return json({ error: 'Resposta SOC não é JSON válido', preview: text.slice(0, 500) }, 502);
    }

    // Map soc_code (CODIGOEMPRESA) -> company_id
    const CHUNK = 500;
    const socCodes = Array.from(new Set(
      contatos.map((c: any) => s(c.CODIGOEMPRESA)).filter(Boolean) as string[],
    ));
    const codeToCompanyId = new Map<string, string>();
    for (let i = 0; i < socCodes.length; i += CHUNK) {
      const slice = socCodes.slice(i, i + CHUNK);
      const { data, error } = await admin.from('companies').select('id, soc_code').in('soc_code', slice);
      if (error) return json({ error: `Falha ao carregar empresas: ${error.message}` }, 500);
      for (const r of data || []) codeToCompanyId.set(r.soc_code as string, r.id as string);
    }

    const now = new Date().toISOString();
    const rowsMap = new Map<string, any>(); // key: `${company_id}::${soc_contact_code}`
    const skipped: any[] = [];

    for (const c of contatos) {
      const empresaCode = s(c.CODIGOEMPRESA);
      const contactCode = s(c.CODIGOCONTATO);
      if (!empresaCode || !contactCode) {
        skipped.push({
          reason: !empresaCode ? 'sem_codigo_empresa' : 'sem_codigo_contato',
          codigo_empresa: empresaCode,
          codigo_contato: contactCode,
          nome: s(c.NOMECONTATO),
        });
        continue;
      }
      const companyId = codeToCompanyId.get(empresaCode);
      if (!companyId) {
        skipped.push({
          reason: 'empresa_nao_encontrada',
          codigo_empresa: empresaCode,
          codigo_contato: contactCode,
          nome: s(c.NOMECONTATO),
        });
        continue;
      }
      rowsMap.set(`${companyId}::${contactCode}`, {
        company_id: companyId,
        soc_contact_code: contactCode,
        nome: s(c.NOMECONTATO),
        telefone_1: s(c.TEL1),
        ramal_1: s(c.RAMAL1),
        telefone_2: s(c.TEL2),
        ramal_2: s(c.RAMAL2),
        email_1: s(c.EMAIL1),
        email_2: s(c.EMAIL2),
        synced_at: now,
      });
    }

    const rows = Array.from(rowsMap.values());

    // Classify inserted vs updated (bulk fetch por company_id, com paginação e
    // ordenação explícitas — mesmo padrão corrigido na sync de Unidades)
    const existingSet = new Set<string>();
    const wantedPairs = new Set(rows.map((r) => `${r.company_id}::${r.soc_contact_code}`));
    const companyIds = Array.from(new Set(rows.map((r) => r.company_id)));
    for (let i = 0; i < companyIds.length; i += CHUNK) {
      const slice = companyIds.slice(i, i + CHUNK);
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await admin
          .from('company_contacts')
          .select('company_id, soc_contact_code, id')
          .in('company_id', slice)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        const rowsPage = data || [];
        for (const r of rowsPage) {
          const key = `${r.company_id}::${r.soc_contact_code}`;
          if (wantedPairs.has(key)) existingSet.add(key);
        }
        if (rowsPage.length < PAGE) break;
        from += PAGE;
      }
    }

    let inserted = 0;
    let updated = 0;
    const errors: any[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const { error } = await admin
        .from('company_contacts')
        .upsert(batch, { onConflict: 'company_id,soc_contact_code' });
      if (error) {
        errors.push({ batch: `${i}-${i + batch.length}`, error: error.message });
        continue;
      }
      for (const r of batch) {
        if (existingSet.has(`${r.company_id}::${r.soc_contact_code}`)) updated++;
        else inserted++;
      }
    }

    console.log(JSON.stringify({
      event: 'soc_contatos_sync_diagnostics',
      soc_rows: contatos.length,
      existing_set_size: existingSet.size,
      inserted,
      updated,
      skipped_count: skipped.length,
      error_count: errors.length,
      synced_at: now,
    }));

    return json({
      ok: true,
      total: contatos.length,
      inserted,
      updated,
      skipped_count: skipped.length,
      skipped: skipped.slice(0, 200),
      error_count: errors.length,
      errors: errors.slice(0, 20),
      synced_at: now,
    });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
