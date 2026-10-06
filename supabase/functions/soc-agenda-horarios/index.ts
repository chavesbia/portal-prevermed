// Consulta horários livres de uma agenda do SOC (Exporta Dados — Horários Livres)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  codigoAgenda: z.string().regex(/^\d{1,12}$/),
  dataInicio: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  dataFim: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const raw = await req.json().catch(() => ({}));
    if (raw?.listarUnidades) {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data } = await admin.from('soc_agenda_unidades').select('id, nome, codigo_agenda').eq('ativo', true).order('nome');
      return json({ unidades: data ?? [] });
    }
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { codigoAgenda, dataInicio, dataFim } = parsed.data;

    const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
    const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_AGENDA');
    const chave = Deno.env.get('SOC_CHAVE_EXPORTA_AGENDA');
    if (!empresa || !codigo || !chave) return json({ error: 'Credenciais SOC ausentes' }, 500);

    const parametro = JSON.stringify({
      empresa, codigo, chave, tipoSaida: 'json',
      empresaTrabalho: empresa,
      codigoAgenda, dataInicio, dataFim,
    });
    const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(parametro)}`, { method: 'POST' });
    const text = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer());
    if (!resp.ok) return json({ error: `SOC HTTP ${resp.status}`, detail: text.slice(0, 500) }, 502);

    let rows: any[] = [];
    try {
      const p = JSON.parse(text);
      rows = Array.isArray(p) ? p : (p?.data ?? []);
    } catch {
      return json({ error: 'Resposta SOC inválida', preview: text.slice(0, 800) }, 502);
    }
    const alvo = String(Number(codigoAgenda));
    const porData: Record<string, string[]> = {};
    for (const r of rows) {
      if (String(Number(r.codigoAgenda)) !== alvo) continue;
      if (r.statusAgenda && String(r.statusAgenda).toLowerCase() !== 'ativo') continue;
      (porData[r.data] ??= []).push(String(r.horario));
    }
    for (const d in porData) porData[d] = [...new Set(porData[d])].sort();
    return json({ porData });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
