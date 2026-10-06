// Consulta horários livres de uma agenda do SOC (Exporta Dados — Horários Livres)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  codigoAgenda: z.string().regex(/^\d{1,12}$/),
  dataInicio: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  dataFim: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  debug: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { codigoAgenda, dataInicio, dataFim, debug } = parsed.data;

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
    if (debug) return json({ total: rows.length, amostra: rows.slice(0, 5) });
    return json({ horarios: rows });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
