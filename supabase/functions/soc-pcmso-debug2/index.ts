// TEMPORÁRIO: teste manual de variações de parâmetro no Exporta Dados PCMSO
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
  const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_DADOS_PCMSO');
  const chave = Deno.env.get('SOC_CHAVE_EXPORTA_DADOS_PCMSO');

  const base: Record<string, string> = {
    empresa: empresa!,
    codigo: codigo!,
    chave: chave!,
    tipoSaida: 'json',
    empresaTrabalho: '1192387',
  };

  const variants: { name: string; params: Record<string, string> }[] = [
    { name: 'dataFim OMITIDO', params: { ...base, dataInicio: '01/01/2000' } },
    { name: 'dataFim VAZIO', params: { ...base, dataInicio: '01/01/2000', dataFim: '' } },
  ];

  const out: any[] = [];
  for (const v of variants) {
    const parametro = JSON.stringify(v.params);
    const url = `${SOC_URL}?parametro=${encodeURIComponent(parametro)}`;
    try {
      const resp = await fetch(url, { method: 'POST' });
      const buf = await resp.arrayBuffer();
      const text = new TextDecoder('iso-8859-1').decode(buf);
      out.push({
        variant: v.name,
        parametro_enviado: { ...v.params, chave: '***', codigo: '***', empresa: '***' },
        http_status: resp.status,
        bytes: buf.byteLength,
        raw: text,
      });
    } catch (e) {
      out.push({ variant: v.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
