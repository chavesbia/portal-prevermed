// Sincroniza dados comerciais/financeiros das empresas com o SOC (ExportaDados — Preço)
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

function int(v: unknown): number | null {
  const t = s(v);
  if (!t) return null;
  const n = parseInt(t.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** Aceita "1.234,56" ou "1234.56". */
function num(v: unknown): number | null {
  const t = s(v);
  if (!t) return null;
  let x = t.replace(/[^\d.,-]/g, '');
  if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
}


function bool(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  const t = s(v);
  if (!t) return null;
  const u = t.toUpperCase();
  if (['1', 'S', 'SIM', 'TRUE', 'T', 'Y'].includes(u)) return true;
  if (['0', 'N', 'NAO', 'NÃO', 'FALSE', 'F'].includes(u)) return false;
  return null;
}

/** Aceita dd/MM/yyyy, yyyy-MM-dd ou ISO. Retorna yyyy-MM-dd. */
function dateOnly(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function pick(row: any, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k];
    const found = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase());
    if (found) return row[found];
  }
  return null;
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
        sync_type: 'preco',
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
    const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_DADOS_PRECO');
    const chave = Deno.env.get('SOC_CHAVE_EXPORTA_DADOS_PRECO');
    if (!empresa || !codigo || !chave) {
      await finalize({ status: 'error', error_message: 'Credenciais SOC ausentes' });
      return json({
        error: 'Credenciais SOC ausentes (SOC_CODIGO_EMPRESA, SOC_CODIGO_EXPORTA_DADOS_PRECO, SOC_CHAVE_EXPORTA_DADOS_PRECO)',
      }, 500);
    }

    const parametro = JSON.stringify({
      empresa,
      codigo,
      chave,
      tipoSaida: 'json',
      codigoEmpresa: '',
    });
    const url = `${SOC_URL}?parametro=${encodeURIComponent(parametro)}`;

    const resp = await fetch(url, { method: 'POST' });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      await finalize({ status: 'error', error_message: `SOC HTTP ${resp.status}` });
      return json({ error: 'Falha ao consultar SOC', status: resp.status, detail: detail.slice(0, 500) }, 502);
    }

    const buf = await resp.arrayBuffer();
    const text = new TextDecoder('iso-8859-1').decode(buf);
    let linhas: any[] = [];
    try {
      const parsed = JSON.parse(text);
      linhas = Array.isArray(parsed) ? parsed : (parsed?.precos || parsed?.data || []);
    } catch {
      await finalize({ status: 'error', error_message: 'Resposta SOC não é JSON válido' });
      return json({ error: 'Resposta SOC não é JSON válido', preview: text.slice(0, 500) }, 502);
    }

    // Uma linha por produto — dados "da empresa" vêm da PRIMEIRA linha
    const now = new Date().toISOString();
    const byCompany = new Map<string, any>();
    const itemsByCode = new Map<string, any[]>();
    let semCodigo = 0;
    for (const row of linhas) {
      const code = s(pick(row, ['codigoEmpresa', 'CODIGOEMPRESA']));
      if (!code) { semCodigo++; continue; }
      if (!byCompany.has(code)) {
        byCompany.set(code, {
          subgrupo: s(pick(row, ['nomeSubgrupo', 'NOMESUBGRUPO'])),
          vidas_ativas: int(pick(row, ['vidasAtivasUltimaContagem', 'VIDASATIVASULTIMACONTAGEM'])),
          classificacao_cliente: s(pick(row, ['classificacaoCliente', 'CLASSIFICACAOCLIENTE'])),
          cliente_inadimplente: bool(pick(row, ['flagClienteInadimplente', 'FLAGCLIENTEINADIMPLENTE'])),
          data_assinatura_contrato: dateOnly(pick(row, ['dataAssinaturaContrato', 'DATAASSINATURACONTRATO'])),
          dia_contagem: s(pick(row, ['diaContagem', 'DIACONTAGEM'])),
          tipo_contagem: s(pick(row, ['tipoContagem', 'TIPOCONTAGEM'])),
          tipo_relatorio_fatura: s(pick(row, ['tipoRelatorioFatura', 'TIPORELATORIOFATURA'])),
          preco_synced_at: now,
        });
      }
      const item = {
        soc_product_code: s(pick(row, ['codigoProduto', 'CODIGOPRODUTO'])),
        product_name: s(pick(row, ['nomeProduto', 'NOMEPRODUTO'])),
        product_group_code: s(pick(row, ['codigoGrupoProduto', 'CODIGOGRUPOPRODUTO'])),
        product_group_name: s(pick(row, ['nomeGrupoProduto', 'NOMEGRUPOPRODUTO'])),
        exames: s(pick(row, ['exames', 'EXAMES'])),
        valor_produto_pontual: num(pick(row, ['valorProdutoPontual', 'VALORPRODUTOPONTUAL'])),
        valor_vida_mes: num(pick(row, ['valorVidaMes', 'VALORVIDAMES'])),
        valor_mensal: num(pick(row, ['valorMensal', 'VALORMENSAL'])),
        valor_anual: num(pick(row, ['valorAnual', 'VALORANUAL'])),
        valor_total_parcela: num(pick(row, ['valorTotalParcela', 'VALORTOTALPARCELA'])),
        valor_minimo: num(pick(row, ['valorMinimo', 'VALORMINIMO'])),
        minimo_vidas: int(pick(row, ['minimoVidas', 'MINIMOVIDAS'])),
        dia_cobranca: s(pick(row, ['dia', 'DIA'])),
        tipo_cobranca: s(pick(row, ['tipoCobranca', 'TIPOCOBRANCA'])),
        valor_evento: num(pick(row, ['valorEvento', 'VALOREVENTO'])),
        synced_at: now,
      };
      const arr = itemsByCode.get(code);
      if (arr) arr.push(item); else itemsByCode.set(code, [item]);
    }


    // Resolve soc_code -> company_id (em blocos, com ordenação estável)
    const CHUNK = 500;
    const codes = Array.from(byCompany.keys());
    const codeToId = new Map<string, string>();
    for (let i = 0; i < codes.length; i += CHUNK) {
      const slice = codes.slice(i, i + CHUNK);
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await admin
          .from('companies')
          .select('id, soc_code')
          .in('soc_code', slice)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          await finalize({ status: 'error', error_message: `Falha ao carregar empresas: ${error.message}` });
          return json({ error: `Falha ao carregar empresas: ${error.message}` }, 500);
        }
        const page = data || [];
        for (const r of page) codeToId.set(r.soc_code as string, r.id as string);
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }

    let updated = 0;
    const skipped: any[] = [];
    const errors: any[] = [];

    // Monta lista de updates e executa em paralelo (evita timeout de 150s)
    const tasks: { id: string; values: any }[] = [];
    for (const [code, values] of byCompany) {
      const companyId = codeToId.get(code);
      if (!companyId) {
        skipped.push({ reason: 'empresa_nao_encontrada', codigo_empresa: code });
        continue;
      }
      tasks.push({ id: companyId, values });
    }

    const CONCURRENCY = 40;
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const slice = tasks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map((t) => admin.from('companies').update(t.values).eq('id', t.id)),
      );
      results.forEach((r, idx) => {
        if (r.error) errors.push({ company_id: slice[idx].id, error: r.error.message });
        else updated++;
      });
    }


    console.log(JSON.stringify({
      event: 'soc_preco_sync_diagnostics',
      soc_rows: linhas.length,
      empresas_distintas: byCompany.size,
      updated,
      skipped_count: skipped.length,
      sem_codigo_empresa: semCodigo,
      error_count: errors.length,
      synced_at: now,
    }));

    await finalize({
      status: errors.length > 0 ? 'partial' : 'success',
      total: linhas.length,
      inserted: 0,
      updated: updated,
      error_count: errors.length,
      errors: errors.slice(0, 20),
      skipped: skipped.slice(0, 200),
      skipped_count: skipped.length,
    });

    return json({
      ok: true,
      total_linhas: linhas.length,
      empresas_distintas: byCompany.size,
      updated,
      skipped_count: skipped.length,
      skipped: skipped.slice(0, 200),
      sem_codigo_empresa: semCodigo,
      error_count: errors.length,
      errors: errors.slice(0, 20),
      synced_at: now,
    });
  } catch (e) {
    await finalize({ status: 'error', error_message: String((e as any)?.message || e) });
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
