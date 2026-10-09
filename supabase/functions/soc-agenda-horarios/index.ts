// Horários livres de uma agenda do SOC, com as regras de Administração → Agenda aplicadas
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { bloqueioExames, bloqueioUnidade, brData, carregarRegras, contarDia, descreverExames, isoData, limiteDia } from '../_shared/agendaRegras.ts';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  unidadeId: z.string().uuid(),
  dataInicio: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  dataFim: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  tipoExame: z.string().max(60).optional(),
  exames: z.array(z.string().max(120)).max(60).default([]),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const raw = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (raw?.listarUnidades) {
      const { data } = await admin.from('soc_agenda_unidades').select('id, nome, codigo_agenda').eq('ativo', true).order('nome');
      return json({ unidades: data ?? [] });
    }
    if (raw?.documentosExigidos) {
      const { data } = await admin.from('agenda_documentos_exigidos').select('tipo_exame, nome, obrigatorio').order('ordem');
      return json({ documentos: data ?? [] });
    }
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { unidadeId, dataInicio, dataFim, tipoExame, exames } = parsed.data;

    const { data: un } = await admin.from('soc_agenda_unidades').select('codigo_agenda, ativo').eq('id', unidadeId).maybeSingle();
    if (!un?.ativo) return json({ error: 'Unidade indisponível' }, 400);

    const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
    const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_AGENDA');
    const chave = Deno.env.get('SOC_CHAVE_EXPORTA_AGENDA');
    if (!empresa || !codigo || !chave) return json({ error: 'Credenciais SOC ausentes' }, 500);

    const parametro = JSON.stringify({ empresa, codigo, chave, tipoSaida: 'json', empresaTrabalho: empresa, codigoAgenda: un.codigo_agenda, dataInicio, dataFim });
    const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(parametro)}`, { method: 'POST' });
    const text = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer());
    if (!resp.ok) return json({ error: `SOC HTTP ${resp.status}` }, 502);

    let rows: any[] = [];
    try { const p = JSON.parse(text); rows = Array.isArray(p) ? p : (p?.data ?? []); }
    catch { return json({ error: 'Resposta SOC inválida' }, 502); }

    // Cada linha do SOC é uma vaga: 2+ linhas no mesmo horário = 2+ vagas
    const alvo = String(Number(un.codigo_agenda));
    const vagasSoc: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (String(Number(r.codigoAgenda)) !== alvo) continue;
      if (r.statusAgenda && String(r.statusAgenda).toLowerCase() !== 'ativo') continue;
      const d = (vagasSoc[r.data] ??= {}); const h = String(r.horario).slice(0, 5);
      d[h] = (d[h] ?? 0) + 1;
    }

    // Retorno ao Trabalho aguardando aprovação ainda não está no SOC: reserva a vaga aqui
    const isoIni = isoData(dataInicio), isoFim = isoData(dataFim);
    const { data: pend } = await admin.from('soc_agendamentos').select('data_agendada, hora_agendada')
      .eq('unidade_id', unidadeId).eq('status', 'aguardando_aprovacao').gte('data_agendada', isoIni).lte('data_agendada', isoFim);
    for (const p of pend ?? []) {
      const d = vagasSoc[brData(p.data_agendada)]; const h = String(p.hora_agendada).slice(0, 5);
      if (d?.[h]) d[h] -= 1;
    }

    const regras = await carregarRegras(admin, unidadeId);
    const porData: Record<string, { hora: string; vagas: number }[]> = {};
    const indisponiveis: { data: string; motivo: string }[] = [];
    for (const br of Object.keys(vagasSoc)) {
      const iso = isoData(br);
      const lim = tipoExame ? limiteDia(regras, iso, tipoExame) : null;
      if (lim !== null && (await contarDia(admin, unidadeId, iso, tipoExame!)) >= lim) {
        indisponiveis.push({ data: br, motivo: `Limite diário de ${tipoExame} atingido` }); continue;
      }
      const lista: { hora: string; vagas: number }[] = [];
      let motivo: string | null = null;
      for (const [hora, vagas] of Object.entries(vagasSoc[br]).sort()) {
        if (vagas <= 0) continue;
        const m = bloqueioUnidade(regras, iso, hora) ?? bloqueioExames(regras, iso, hora, exames);
        if (m) { motivo ??= m; continue; }
        lista.push({ hora, vagas });
      }
      if (lista.length) porData[br] = lista;
      else if (motivo) indisponiveis.push({ data: br, motivo });
    }
    return json({ porData, indisponiveis, regrasExames: descreverExames(regras, exames) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
