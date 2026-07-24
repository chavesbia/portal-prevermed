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

    // --- RAW INVESTIGATION (temporário) ---
    const allFieldNames = new Set<string>();
    for (const e of empresas) {
      if (e && typeof e === 'object') for (const k of Object.keys(e)) allFieldNames.add(k);
    }
    const sampleSocnet = empresas.find((e: any) => String(e?.RAZAOSOCIAL || e?.RAZAOSOCIALINICIAL || '').toUpperCase().includes('SOCNET')) || null;
    const sampleSemCnpj = empresas.find((e: any) => {
      const c = String(e?.CNPJ ?? '').replace(/\D/g, '');
      return !c && !String(e?.RAZAOSOCIAL || '').toUpperCase().includes('SOCNET');
    }) || null;
    const sampleComCnpj = empresas.find((e: any) => String(e?.CNPJ ?? '').replace(/\D/g, '').length >= 14) || null;
    if (logId) {
      await admin.from('companies_sync_log').update({
        all_field_names: Array.from(allFieldNames).sort(),
        raw_samples: {
          socnet_sem_cnpj: sampleSocnet,
          pessoa_fisica_ou_sem_cnpj: sampleSemCnpj,
          normal_com_cnpj: sampleComCnpj,
        },
      }).eq('id', logId);
    }
    // --- FIM INVESTIGAÇÃO ---


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
        const upper = (razao || '').toUpperCase();
        const ie = s(e.INSCRICAOESTADUAL);
        const im = s(e.INSCRICAOMUNICIPAL);
        const hasCorpMarker = /\b(LTDA|ME|EIRELI|EPP|S\/A|S\.A\.?|SA|MEI|LTDA\.?|CIA|COMPANHIA|ASSOCIACAO|ASSOCIAÇÃO|INSTITUTO|FUNDACAO|FUNDAÇÃO|COOPERATIVA|SINDICATO|IGREJA|MUNICIPIO|MUNICÍPIO|PREFEITURA|SINDICATO)\b/.test(upper);
        const isPF = !ie && !im && !hasCorpMarker && !upper.includes('SOCNET');
        let reason: string;
        let motivo: string;
        if (upper.includes('SOCNET')) {
          reason = 'socnet_sem_cnpj';
          motivo = 'Parceiro SOCNET sem CNPJ cadastrado no SOC';
        } else if (isPF) {
          reason = 'pessoa_fisica_sem_cnpj';
          motivo = 'Cliente Pessoa Física (sem CNPJ aplicável)';
        } else {
          reason = 'sem_cnpj';
          motivo = 'Empresa sem CNPJ no SOC';
        }
        skipped.push({ reason, motivo, soc_code, razao_social: razao, cnpj: s(e.CNPJ) });
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

    // ============================================================
    // SEGUNDA CHAMADA — Cadastro de Empresas (SOCNET)
    // Controlada pelo toggle app_settings.socnet_sync_enabled
    // ============================================================
    let socnetTotal = 0;
    let socnetInserted = 0;
    let socnetUpdated = 0;
    const socnetErrors: any[] = [];
    const socnetSkipped: any[] = [];
    let socnetStatusValues: string[] = [];
    let socnetEnabled = false;

    try {
      const { data: cfg } = await admin
        .from('app_settings')
        .select('value')
        .eq('key', 'socnet_sync_enabled')
        .maybeSingle();
      socnetEnabled = cfg?.value === true || String(cfg?.value ?? '').toLowerCase() === 'true';
    } catch (_e) {
      socnetEnabled = false;
    }

    if (socnetEnabled) {
      const codigoSocnet = Deno.env.get('SOC_CODIGO_EXPORTA_DADOS_SOCNET');
      const chaveSocnet = Deno.env.get('SOC_CHAVE_EXPORTA_DADOS_SOCNET');

      if (codigoSocnet && chaveSocnet) {
        try {
          const paramSocnet = JSON.stringify({
            empresa,
            codigo: codigoSocnet,
            chave: chaveSocnet,
            tipoSaida: 'json',
            empresafiltro: '',
            subgrupo: '',
            socnet: '1',
            mostrarinativas: '1',
          });
          const urlSocnet = `${SOC_URL}?parametro=${encodeURIComponent(paramSocnet)}`;
          const respSN = await fetch(urlSocnet, { method: 'POST' });
          if (!respSN.ok) {
            const detail = await respSN.text().catch(() => '');
            socnetErrors.push({ error: `SOC SOCNET HTTP ${respSN.status}: ${detail.slice(0, 500)}` });
          } else {
            const bufSN = await respSN.arrayBuffer();
            const textSN = new TextDecoder('iso-8859-1').decode(bufSN);
            let parceiros: any[] = [];
            try {
              const parsed = JSON.parse(textSN);
              parceiros = Array.isArray(parsed) ? parsed : (parsed?.empresas || parsed?.data || []);
            } catch (_e) {
              socnetErrors.push({ error: 'Resposta SOC SOCNET não é JSON válido', preview: textSN.slice(0, 300) });
            }
            socnetTotal = parceiros.length;

            const statusSet = new Set<string>();
            for (const p of parceiros) {
              const v = (p as any)?.status;
              if (v !== undefined && v !== null) statusSet.add(String(v));
            }
            socnetStatusValues = Array.from(statusSet);

            const isActiveFrom = (v: unknown): boolean => {
              if (v === true) return true;
              if (v === false) return false;
              const t = String(v ?? '').trim().toUpperCase();
              return t === '1' || t === 'ATIVO' || t === 'A' || t === 'SIM' || t === 'TRUE';
            };

            const rowsSNMap = new Map<string, any>();
            for (const p of parceiros) {
              const soc_code = s((p as any).codigo);
              const razao = s((p as any).razaoSocial) || s((p as any).nome);
              if (!soc_code) {
                socnetSkipped.push({ reason: 'sem_codigo', motivo: 'Registro SOCNET sem código', razao_social: razao });
                continue;
              }
              rowsSNMap.set(soc_code, {
                soc_code,
                cnpj: digits((p as any).cnpj),
                nome_abreviado: s((p as any).nome),
                razao_social: razao || soc_code,
                cep: digits((p as any).cep),
                logradouro: s((p as any).endereco),
                numero: s((p as any).numeroEndereco),
                bairro: s((p as any).bairro),
                cidade: s((p as any).cidade),
                estado: s((p as any).uf),
                inscricao_estadual: s((p as any).inscricaoEstadual),
                inscricao_municipal: s((p as any).inscricaoMunicipal),
                is_active: isActiveFrom((p as any).status),
                codigo_cliente_integracao: s((p as any).codigoEmpresaClienteIntegracao),
                is_socnet: true,
                synced_at: now,
              });
            }
            const rowsSN = Array.from(rowsSNMap.values());
            const codesSN = rowsSN.map((r) => r.soc_code);

            const existingSN = new Set<string>();
            for (let i = 0; i < codesSN.length; i += CHUNK) {
              const slice = codesSN.slice(i, i + CHUNK);
              const { data, error } = await admin.from('companies').select('soc_code').in('soc_code', slice);
              if (error) { socnetErrors.push({ error: `select existing socnet: ${error.message}` }); continue; }
              for (const r of data || []) existingSN.add(r.soc_code as string);
            }

            for (let i = 0; i < rowsSN.length; i += CHUNK) {
              const batch = rowsSN.slice(i, i + CHUNK);
              const { error } = await admin.from('companies').upsert(batch, { onConflict: 'soc_code' });
              if (error) {
                socnetErrors.push({ batch: `${i}-${i + batch.length}`, error: error.message });
                continue;
              }
              for (const r of batch) {
                if (existingSN.has(r.soc_code)) socnetUpdated++; else socnetInserted++;
              }
            }
          }
        } catch (e) {
          socnetErrors.push({ error: `SOCNET exception: ${String((e as any)?.message || e)}` });
        }
      } else {
        socnetErrors.push({ error: 'Credenciais SOCNET ausentes (SOC_CODIGO_EXPORTA_DADOS_SOCNET, SOC_CHAVE_EXPORTA_DADOS_SOCNET)' });
      }
    }



    const totalErrors = errors.length + socnetErrors.length;
    const totalOk = inserted + updated + socnetInserted + socnetUpdated;
    const status = totalErrors === 0 ? 'success' : (totalOk > 0 ? 'partial' : 'error');
    await finalize({
      status,
      total: empresas.length + socnetTotal,
      inserted: inserted + socnetInserted,
      updated: updated + socnetUpdated,
      error_count: totalErrors,
      errors: [...errors, ...socnetErrors].slice(0, 100),
      skipped: [...skipped, ...socnetSkipped].slice(0, 500),
      skipped_count: skipped.length + socnetSkipped.length,
    });

    return json({
      ok: true,
      log_id: logId,
      principal: {
        total: empresas.length,
        inserted,
        updated,
        error_count: errors.length,
        skipped_count: skipped.length,
      },
      socnet: {
        total: socnetTotal,
        inserted: socnetInserted,
        updated: socnetUpdated,
        error_count: socnetErrors.length,
        skipped_count: socnetSkipped.length,
        status_values: socnetStatusValues,
        errors: socnetErrors.slice(0, 20),
      },
      synced_at: now,
      status,
    });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});


