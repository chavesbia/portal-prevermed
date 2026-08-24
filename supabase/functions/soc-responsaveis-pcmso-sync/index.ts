// Sincroniza responsáveis técnicos pelo PCMSO com o SOC
// (ExportaDados — "Responsáveis do PCMSO - Por período e empresa")
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

// SOC devolve datas em dd/mm/yyyy ou yyyy-mm-dd
function toDate(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let finalize: (patch: Record<string, unknown>) => Promise<void> = async () => {};

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.replace('Bearer ', '');
    const internalSecret = Deno.env.get('SOC_SYNC_INTERNAL_SECRET');
    const isInternal = Boolean(internalSecret) && req.headers.get('x-soc-sync-secret') === internalSecret;

    const supabase = createClient(
      supabaseUrl,
      anonKey,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = isInternal
      ? { data: null, error: null }
      : await supabase.auth.getClaims(token);
    if (!isInternal && (claimsErr || !claims?.claims)) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const startedAt = new Date().toISOString();
    const { data: logRow } = await admin
      .from('companies_sync_log')
      .insert({
        sync_type: 'responsaveis_pcmso',
        started_at: startedAt,
        status: 'running',
        triggered_by: isInternal ? null : (claims?.claims as any)?.sub ?? null,
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
    const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_DADOS_PCMSO');
    const chave = Deno.env.get('SOC_CHAVE_EXPORTA_DADOS_PCMSO');
    if (!empresa || !codigo || !chave) {
      await finalize({ status: 'error', error_message: 'Credenciais SOC ausentes' });
      return json({
        error: 'Credenciais SOC ausentes (SOC_CODIGO_EMPRESA, SOC_CODIGO_EXPORTA_DADOS_PCMSO, SOC_CHAVE_EXPORTA_DADOS_PCMSO)',
      }, 500);
    }

    const CHUNK = 500;

    // Este Exporta Dados exige "empresaTrabalho" (código SOC da empresa cliente).
    // Portanto consultamos empresa a empresa.
    const empresas: { id: string; soc_code: string }[] = [];
    {
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await admin
          .from('companies')
          .select('id, soc_code')
          .not('soc_code', 'is', null)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          await finalize({ status: 'error', error_message: `Falha ao carregar empresas: ${error.message}` });
          return json({ error: `Falha ao carregar empresas: ${error.message}` }, 500);
        }
        const page = (data || []) as any[];
        for (const c of page) if (c.soc_code) empresas.push({ id: c.id, soc_code: String(c.soc_code) });
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Diferencia "SOC OK com lista vazia" de "SOC recusou/erro" (throttling etc.)
    const fetchEmpresa = async (
      c: { id: string; soc_code: string },
    ): Promise<{ ok: true; rows: any[] } | { ok: false; reason: string }> => {
      const parametro = JSON.stringify({
        empresa,
        codigo,
        chave,
        tipoSaida: 'json',
        dataInicio: '01/01/2000',
        dataFim: '31/12/2999',
        empresaTrabalho: c.soc_code,
      });
      const url = `${SOC_URL}?parametro=${encodeURIComponent(parametro)}`;

      let lastReason = 'erro desconhecido';
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await sleep(1000 * Math.pow(2, attempt - 1)); // 1s, 2s
        try {
          const resp = await fetch(url, { method: 'POST' });
          if (!resp.ok) {
            lastReason = `HTTP ${resp.status} ${resp.statusText}`;
            continue;
          }
          const buf = await resp.arrayBuffer();
          const text = new TextDecoder('iso-8859-1').decode(buf);
          // Respostas de limite/erro do SOC vêm como texto, não JSON
          if (/limite|excedid|simult|tente novamente|indisponível|indisponivel/i.test(text)) {
            lastReason = `SOC recusou: ${text.slice(0, 200)}`;
            continue;
          }
          let parsed: any;
          try {
            parsed = JSON.parse(text);
          } catch {
            lastReason = `resposta não-JSON: ${text.slice(0, 200)}`;
            continue;
          }
          const arr = Array.isArray(parsed) ? parsed : (parsed?.data || []);
          return {
            ok: true,
            rows: (arr as any[]).map((r) => ({ ...r, __companyId: c.id, __socCode: c.soc_code })),
          };
        } catch (e) {
          lastReason = e instanceof Error ? e.message : 'erro de rede';
        }
      }
      return { ok: false, reason: lastReason };
    };

    const linhas: any[] = [];
    const socErrors: any[] = [];
    let empresasSemResponsavel = 0;
    const CONCURRENCY = 4; // SOC documenta limite de 5 chamadas simultâneas
    for (let i = 0; i < empresas.length; i += CONCURRENCY) {
      const batch = empresas.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((c) => fetchEmpresa(c).then((r) => ({ c, r }))));
      for (const { c, r } of results) {
        if (!r.ok) {
          console.error(
            `[soc-responsaveis-pcmso-sync] falha real na empresa ${c.soc_code}: ${r.reason}`,
          );
          socErrors.push({ scope: 'soc_fetch', soc_code: c.soc_code, company_id: c.id, message: r.reason });
          continue;
        }
        if (r.rows.length === 0) empresasSemResponsavel++;
        linhas.push(...r.rows);
      }
    }
    console.log(
      `[soc-responsaveis-pcmso-sync] empresas: ${empresas.length}, sem responsável: ${empresasSemResponsavel}, falhas reais: ${socErrors.length}`,
    );



    // Mapa `${company_id}::${soc_unit_code}` -> unidade_id
    const companyIds = Array.from(new Set(linhas.map((r: any) => r.__companyId as string)));
    const unitKeyToId = new Map<string, string>();
    const unitMapErrors: any[] = [];
    const UNIT_CHUNK = 50; // evita URL grande demais no PostgREST
    for (let i = 0; i < companyIds.length; i += UNIT_CHUNK) {
      const slice = companyIds.slice(i, i + UNIT_CHUNK);
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await admin
          .from('company_units')
          .select('id, company_id, soc_unit_code')
          .in('company_id', slice)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          const detail = {
            batch: Math.floor(i / UNIT_CHUNK),
            offset: from,
            company_ids: slice.length,
            first_company_id: slice[0],
            message: error.message,
            details: (error as any).details ?? null,
            hint: (error as any).hint ?? null,
            code: (error as any).code ?? null,
          };
          console.error('[soc-responsaveis-pcmso-sync] falha ao carregar company_units', JSON.stringify(detail));
          unitMapErrors.push(detail);
          break;
        }
        const page = data || [];
        for (const u of page) {
          if (u.soc_unit_code) unitKeyToId.set(`${u.company_id}::${u.soc_unit_code}`, u.id as string);
        }
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }
    console.log(
      `[soc-responsaveis-pcmso-sync] mapa de unidades: ${unitKeyToId.size} pares carregados, ${unitMapErrors.length} lotes com falha`,
    );


    const now = new Date().toISOString();
    const rows: any[] = [];
    const skipped: any[] = [];

    const pick = (r: any, names: string[]) => {
      for (const n of names) {
        if (r[n] !== undefined && r[n] !== null) return r[n];
        const up = Object.keys(r).find((k) => k.toLowerCase() === n.toLowerCase());
        if (up && r[up] !== undefined && r[up] !== null) return r[up];
      }
      return null;
    };

    for (const r of linhas) {
      const companyId = r.__companyId as string | undefined;
      if (!companyId) {
        skipped.push({
          reason: 'empresa_nao_encontrada',
          soc_code: s(r.__socCode),
          motivo: 'Empresa não encontrada na base mestre',
        });
        continue;
      }
      const unitCode = s(pick(r, ['codigoUnidade', 'CODIGOUNIDADE']));
      rows.push({
        company_id: companyId,
        unidade_id: unitCode ? (unitKeyToId.get(`${companyId}::${unitCode}`) ?? null) : null,
        unidade_nome_raw: s(pick(r, ['nomeUnidade', 'NOMEUNIDADE'])),
        nome_medico: s(pick(r, ['nomeMedico', 'NOMEMEDICO'])),
        nome_conselho: s(pick(r, ['nomeConselho', 'NOMECONSELHO'])),
        conselho: s(pick(r, ['conselho', 'CONSELHO'])),
        uf_conselho: s(pick(r, ['ufConselho', 'UFCONSELHO'])),
        email_responsavel: s(pick(r, ['emailResponsavel', 'EMAILRESPONSAVEL'])),
        data_inicio: toDate(pick(r, ['dataInicio', 'DATAINICIO'])),
        data_fim: toDate(pick(r, ['dataFim', 'DATAFIM'])),
        synced_at: now,
      });
    }


    // Segurança: não apaga a base se o SOC não devolveu nada
    if (rows.length === 0) {
      await finalize({
        status: 'error',
        error_message: 'SOC não retornou responsáveis (nenhuma linha)',
        total: 0,
        error_count: socErrors.length,
        errors: socErrors.slice(0, 100),
      });
      return json({ error: 'SOC não retornou responsáveis', empresas: empresas.length, soc_errors: socErrors.length }, 502);
    }

    // Recadastramento total: limpa e insere tudo
    const { error: delErr } = await admin
      .from('company_responsaveis_pcmso')
      .delete()
      .not('id', 'is', null);

    if (delErr) {
      await finalize({ status: 'error', error_message: `Falha ao limpar tabela: ${delErr.message}` });
      return json({ error: `Falha ao limpar tabela: ${delErr.message}` }, 500);
    }

    let inserted = 0;
    const errors: any[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await admin.from('company_responsaveis_pcmso').insert(slice);
      if (error) errors.push({ batch: i / CHUNK, message: error.message });
      else inserted += slice.length;
    }

    const status =
      errors.length > 0 || unitMapErrors.length > 0 || socErrors.length > 0 ? 'partial' : 'success';
    await finalize({
      status,
      total: linhas.length,
      inserted,
      updated: 0,
      error_count: errors.length + unitMapErrors.length + socErrors.length,
      errors: [
        ...errors,
        ...unitMapErrors.map((e) => ({ ...e, scope: 'unit_map' })),
        ...socErrors.slice(0, 200),
      ],
      skipped: skipped.slice(0, 500),
      skipped_count: skipped.length,
    });

    return json({
      ok: true,
      total: linhas.length,
      inserted,
      skipped_count: skipped.length,
      error_count: errors.length,
      empresas_consultadas: empresas.length,
      empresas_sem_responsavel: empresasSemResponsavel,
      soc_failures: socErrors.length,
      soc_failures_sample: socErrors.slice(0, 10),
      unit_map_pairs: unitKeyToId.size,
      unit_map_failed_batches: unitMapErrors.length,
      unidade_id_preenchido: rows.filter((r) => r.unidade_id).length,
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro inesperado';
    await finalize({ status: 'error', error_message: message });
    return json({ error: message }, 500);
  }
});
