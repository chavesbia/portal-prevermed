// Busca pública para o agendamento: empresa por CNPJ (base do portal), colaborador por CPF e exames do PCMSO (SOC Exporta Dados)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Pessoa = { cnpj: z.string().regex(/^\d{14}$/), socCode: z.string().regex(/^\d{1,12}$/), cpf: z.string().regex(/^\d{11}$/) };
const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('empresa'), cnpj: z.string().regex(/^\d{14}$/) }),
  z.object({ acao: z.literal('funcionario'), ...Pessoa }),
  z.object({ acao: z.literal('exames'), ...Pessoa }),
]);

type Row = Record<string, unknown>;
const pick = (r: Row, keys: string[]) => {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(r)) map[k.toUpperCase().replace(/[^A-Z]/g, '')] = r[k];
  for (const k of keys) { const v = map[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim(); }
  return null;
};
const sim = (v: string | null) => !!v && /^(s|sim|true|1|x)$/i.test(v);

async function exporta(params: Record<string, string>): Promise<Row[] | null> {
  const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(JSON.stringify({ ...params, tipoSaida: 'json' }))}`, { method: 'POST' });
  const text = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer());
  if (!resp.ok) { console.error('SOC HTTP', resp.status, text.slice(0, 300)); return null; }
  try { const p = JSON.parse(text); return Array.isArray(p) ? p : (p?.data ?? []); }
  catch { console.error('SOC resposta', text.slice(0, 300)); return null; }
}

async function buscarFuncionario(socCode: string, cpf: string) {
  const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
  const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_FUNCIONARIO');
  const chave = Deno.env.get('SOC_CHAVE_EXPORTA_FUNCIONARIO');
  if (!empresa || !codigo || !chave) return null;
  const rows = await exporta({
    empresa, codigo, chave, empresaTrabalho: socCode, cpf,
    ativo: 'Sim', inativo: 'Nao', afastado: 'Sim', pendente: 'Sim', ferias: 'Sim',
  });
  if (!rows) return null;
  const doCpf = rows.filter((r) => (pick(r, ['CPF', 'CPFFUNCIONARIO']) ?? '').replace(/\D/g, '').padStart(11, '0') === cpf);
  return doCpf.find((r) => !/inativ|demit/i.test(pick(r, ['SITUACAO', 'SITUACAOFUNCIONARIO']) ?? '')) ?? doCpf[0] ?? false;
}

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

    const ativo = await buscarFuncionario(b.socCode, b.cpf);
    if (ativo === null) return json(b.acao === 'exames' ? { exames: [], indisponivel: true } : { encontrado: false, indisponivel: true });
    if (ativo === false) return json(b.acao === 'exames' ? { exames: [] } : { encontrado: false });

    if (b.acao === 'exames') {
      const codFunc = pick(ativo, ['CODIGO', 'CODIGOFUNCIONARIO', 'CODFUNCIONARIO']);
      const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
      const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_EXAMES');
      const chave = Deno.env.get('SOC_CHAVE_EXPORTA_EXAMES');
      if (!codFunc || !empresa || !codigo || !chave) return json({ exames: [], indisponivel: true });
      const rows = await exporta({ empresa, codigo, chave, funcionario: codFunc, empresaFuncionario: b.socCode });
      if (!rows) return json({ exames: [], indisponivel: true });
      if (rows[0]) console.log('SOC exames campos', Object.keys(rows[0]).join(','), 'linhas', rows.length);
      const exames = rows.map((r) => ({
        nome: (pick(r, ['NOMEEXAME']) ?? '').toUpperCase(),
        periodicidade: pick(r, ['PERIODICIDADE']),
        tipos: {
          'Admissional': sim(pick(r, ['APLICACAOEXAMEADMISSIONAL'])),
          'Periódico': sim(pick(r, ['APLICACAOEXAMEPERIODICO'])),
          'Demissional': sim(pick(r, ['APLICACAOEXAMEDEMISSIONAL'])),
          'Retorno ao Trabalho': sim(pick(r, ['APLICACAOEXAMERETORNOTRABALHO'])),
          'Mudança de Risco': sim(pick(r, ['APLICACAOEXAMEMUDANCAFUNCAO'])),
        },
      })).filter((e) => e.nome);
      return json({ exames });
    }

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
