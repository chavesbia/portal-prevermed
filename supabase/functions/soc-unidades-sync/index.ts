// Sincroniza unidades das empresas com o SOC (ExportaDados — Cadastro de Unidades)
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

function isActiveFrom(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const t = String(v ?? '').trim().toUpperCase();
  return t === '1' || t === 'ATIVO' || t === 'A' || t === 'SIM' || t === 'TRUE';
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
    const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_DADOS_UNIDADES');
    const chave = Deno.env.get('SOC_CHAVE_EXPORTA_DADOS_UNIDADES');
    if (!empresa || !codigo || !chave) {
      return json({
        error: 'Credenciais SOC ausentes (SOC_CODIGO_EMPRESA, SOC_CODIGO_EXPORTA_DADOS_UNIDADES, SOC_CHAVE_EXPORTA_DADOS_UNIDADES)',
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
    let unidades: any[] = [];
    try {
      const parsed = JSON.parse(text);
      unidades = Array.isArray(parsed) ? parsed : (parsed?.unidades || parsed?.data || []);
    } catch {
      return json({ error: 'Resposta SOC não é JSON válido', preview: text.slice(0, 500) }, 502);
    }

    // Map soc_code (CODIGOEMPRESA) -> company_id
    const socCodes = Array.from(new Set(
      unidades.map((u: any) => s(u.CODIGOEMPRESA)).filter(Boolean) as string[],
    ));
    const codeToCompanyId = new Map<string, string>();
    const CHUNK = 500;
    for (let i = 0; i < socCodes.length; i += CHUNK) {
      const slice = socCodes.slice(i, i + CHUNK);
      const { data, error } = await admin.from('companies').select('id, soc_code').in('soc_code', slice);
      if (error) return json({ error: `Falha ao carregar empresas: ${error.message}` }, 500);
      for (const r of data || []) codeToCompanyId.set(r.soc_code as string, r.id as string);
    }

    const now = new Date().toISOString();
    const rowsMap = new Map<string, any>(); // key: `${company_id}::${soc_unit_code}`
    const skipped: any[] = [];

    for (const u of unidades) {
      const empresaCode = s(u.CODIGOEMPRESA);
      const socUnitCode = s(u.CODIGOUNIDADE);
      if (!empresaCode || !socUnitCode) {
        skipped.push({
          reason: !empresaCode ? 'sem_codigo_empresa' : 'sem_codigo_unidade',
          codigo_empresa: empresaCode,
          nome_empresa: s(u.NOMEEMPRESA),
          codigo_unidade: socUnitCode,
          nome_unidade: s(u.NOMEUNIDADE),
        });
        continue;
      }
      const companyId = codeToCompanyId.get(empresaCode);
      if (!companyId) {
        skipped.push({
          reason: 'empresa_nao_encontrada',
          codigo_empresa: empresaCode,
          nome_empresa: s(u.NOMEEMPRESA),
          codigo_unidade: socUnitCode,
          nome_unidade: s(u.NOMEUNIDADE),
        });
        continue;
      }
      rowsMap.set(`${companyId}::${socUnitCode}`, {
        company_id: companyId,
        soc_unit_code: socUnitCode,
        name: s(u.NOMEUNIDADE),
        razao_social: s(u.RAZAOSOCIAL),
        risk_grade: s(u.GRAUDERISCOUNIDADE),
        is_active: isActiveFrom(u.UNIDADEATIVA),
        cnpj: digits(u.CNPJUNIDADE),
        cpf: digits(u.CPFUNIDADE),
        inscricao_estadual: s(u.INSCRICAOESTADUALUNIDADE),
        codigo_cliente_integracao: s(u.CODIGOCLIENTEINTEGRACAO),
        cep: digits(u.CEP),
        logradouro: s(u.ENDERECO),
        numero: s(u.NUMEROENDERECO),
        complemento: s(u.COMPLEMENTO),
        bairro: s(u.BAIRRO),
        cidade: s(u.CIDADE),
        estado: s(u.UF),
        synced_at: now,
      });
    }

    const rows = Array.from(rowsMap.values());

    // Classify inserted vs updated by looking up existing rows.
    // Fetch existing (company_id, soc_unit_code) grouping by company_id so we
    // only match the exact pair, not the cartesian product of both .in() lists.
    const existingSet = new Set<string>();
    const byCompany = new Map<string, string[]>();
    for (const r of rows) {
      const arr = byCompany.get(r.company_id) || [];
      arr.push(r.soc_unit_code);
      byCompany.set(r.company_id, arr);
    }
    for (const [companyId, unitCodes] of byCompany) {
      for (let i = 0; i < unitCodes.length; i += CHUNK) {
        const slice = unitCodes.slice(i, i + CHUNK);
        const { data, error } = await admin
          .from('company_units')
          .select('soc_unit_code')
          .eq('company_id', companyId)
          .in('soc_unit_code', slice);
        if (error) continue;
        for (const r of data || []) existingSet.add(`${companyId}::${r.soc_unit_code}`);
      }
    }

    let inserted = 0;
    let updated = 0;
    const errors: any[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const { error } = await admin
        .from('company_units')
        .upsert(batch, { onConflict: 'company_id,soc_unit_code' });
      if (error) {
        errors.push({ batch: `${i}-${i + batch.length}`, error: error.message });
        continue;
      }
      for (const r of batch) {
        if (existingSet.has(`${r.company_id}::${r.soc_unit_code}`)) updated++;
        else inserted++;
      }
    }

    return json({
      ok: true,
      total: unidades.length,
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
