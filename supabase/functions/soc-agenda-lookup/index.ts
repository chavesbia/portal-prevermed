// Busca pública para o agendamento: empresa por CNPJ (base do portal) e colaborador por CPF (SOC Exporta Dados)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('empresa'), cnpj: z.string().regex(/^\d{14}$/) }),
  z.object({ acao: z.literal('funcionario'), cnpj: z.string().regex(/^\d{14}$/), socCode: z.string().regex(/^\d{1,12}$/), cpf: z.string().regex(/^\d{11}$/) }),
]);

const pick = (r: Record<string, unknown>, keys: string[]) => {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(r)) map[k.toUpperCase().replace(/[^A-Z]/g, '')] = r[k];
  for (const k of keys) { const v = map[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim(); }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Dados inválidos' }, 400);
    const b = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: empresas } = await admin.from('companies')
      .select('soc_code, razao_social, nome_abreviado, cidade, estado')
      .eq('cnpj', b.cnpj).eq('is_active', true).order('razao_social');

    if (b.acao === 'empresa') return json({ empresas: empresas ?? [] });

    // Só consulta colaborador de empresa ativa vinculada ao CNPJ informado
    if (!empresas?.some((e) => e.soc_code === b.socCode)) return json({ error: 'Empresa inválida' }, 400);

    const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
    const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_FUNCIONARIO');
    const chave = Deno.env.get('SOC_CHAVE_EXPORTA_FUNCIONARIO');
    if (!empresa || !codigo || !chave) return json({ encontrado: false, indisponivel: true });

    const parametro = JSON.stringify({ empresa, codigo, chave, tipoSaida: 'json', empresaTrabalho: b.socCode, cpf: b.cpf });
    const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(parametro)}`, { method: 'POST' });
    const text = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer());
    if (!resp.ok) return json({ encontrado: false, indisponivel: true });
    let rows: Record<string, unknown>[] = [];
    try { const p = JSON.parse(text); rows = Array.isArray(p) ? p : (p?.data ?? []); } catch { return json({ encontrado: false, indisponivel: true }); }

    const doCpf = rows.filter((r) => (pick(r, ['CPF', 'CPFFUNCIONARIO']) ?? '').replace(/\D/g, '').padStart(11, '0') === b.cpf);
    const ativo = doCpf.find((r) => !/inativ|demit/i.test(pick(r, ['SITUACAO', 'SITUACAOFUNCIONARIO']) ?? '')) ?? doCpf[0];
    if (!ativo) return json({ encontrado: false });
    return json({
      encontrado: true,
      funcionario: {
        nome: pick(ativo, ['NOME', 'NOMEFUNCIONARIO']),
        matricula: pick(ativo, ['MATRICULAFUNCIONARIO', 'MATRICULA']),
        cargo: pick(ativo, ['NOMECARGO', 'CARGO']),
        setor: pick(ativo, ['NOMESETOR', 'SETOR']),
        unidade: pick(ativo, ['NOMEUNIDADE', 'UNIDADE']),
        situacao: pick(ativo, ['SITUACAO', 'SITUACAOFUNCIONARIO']),
      },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
