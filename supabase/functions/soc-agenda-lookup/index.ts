// Busca pública para o agendamento: empresa por CNPJ (base do portal), colaborador por CPF e exames do PCMSO (SOC Exporta Dados)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { cadastrarFuncionarioSoc } from './socFuncionario.ts';

const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Ref = z.object({ codigo: z.string().regex(/^[\w.-]{1,20}$/).optional(), nome: z.string().trim().min(2).max(130).optional() })
  .refine((r) => r.codigo || r.nome);
const Pessoa = { cnpj: z.string().regex(/^\d{14}$/), socCode: z.string().regex(/^\d{1,12}$/), cpf: z.string().regex(/^\d{11}$/) };
const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('empresa'), cnpj: z.string().regex(/^\d{14}$/) }),
  z.object({ acao: z.literal('funcionario'), ...Pessoa }),
  z.object({ acao: z.literal('exames'), ...Pessoa }),
  z.object({ acao: z.literal('hierarquia'), cnpj: Pessoa.cnpj, socCode: Pessoa.socCode }),
  z.object({
    acao: z.literal('cadastrar'), ...Pessoa,
    nome: z.string().trim().min(3).max(120),
    dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dataAdmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sexo: z.enum(['MASCULINO', 'FEMININO']),
    unidade: Ref, setor: Ref, cargo: Ref,
  }),
]);

// Subgrupos com laudos (PGR/PCMSO): só podem selecionar unidade/setor/cargo existentes.
// Pontual/Parceiras: podem criar. Sem subgrupo → regra restrita (mais segura).
const SUBGRUPOS_LIVRES = ['000000004', '000000010', '000000002', 'PARCEIRAS COM PRONTUARIO', 'PARCEIRAS VIA SOCNET', 'PONTUAL - EXAMES'];
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const podeCriar = (subgrupo: string | null) => !!subgrupo && SUBGRUPOS_LIVRES.includes(norm(subgrupo));

async function hierarquia(socCode: string, livre: boolean) {
  const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
  const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_HIERARQUIA');
  const chave = Deno.env.get('SOC_CHAVE_EXPORTA_HIERARQUIA');
  if (!empresa || !codigo || !chave) return null;
  const rows = await exporta({ empresa, codigo, chave, empresaTrabalho: socCode });
  if (!rows) return null;
  const ativo = (v: string | null) => v === null || sim(v) || /ativ/i.test(v) && !/inativ/i.test(v);
  type C = { codigo: string; nome: string };
  const unidades = new Map<string, C & { setores: Map<string, C & { cargos: Map<string, C> }> }>();
  for (const r of rows) {
    if (!ativo(pick(r, ['HIERARQUIAATIVA']))) continue;
    const u = { codigo: pick(r, ['CODIGOUNIDADE']), nome: pick(r, ['NOMEUNIDADE']), a: pick(r, ['ATIVOUNIDADE']) };
    const s = { codigo: pick(r, ['CODIGOSETOR']), nome: pick(r, ['NOMESETOR']), a: pick(r, ['ATIVOSETOR']) };
    const c = { codigo: pick(r, ['CODIGOCARGO']), nome: pick(r, ['NOMECARGO']), a: pick(r, ['ATIVOCARGO']) };
    if (!u.codigo || !u.nome || !ativo(u.a)) continue;
    if (!unidades.has(u.codigo)) unidades.set(u.codigo, { codigo: u.codigo, nome: u.nome, setores: new Map() });
    if (!s.codigo || !s.nome || !ativo(s.a)) continue;
    const us = unidades.get(u.codigo)!.setores;
    if (!us.has(s.codigo)) us.set(s.codigo, { codigo: s.codigo, nome: s.nome, cargos: new Map() });
    if (c.codigo && c.nome && ativo(c.a)) us.get(s.codigo)!.cargos.set(c.codigo, { codigo: c.codigo, nome: c.nome });
  }
  const ord = <T extends C>(m: Iterable<T>) => [...m].sort((a, b) => a.nome.localeCompare(b.nome));
  const arvore = ord(unidades.values()).map((u) => ({
    codigo: u.codigo, nome: u.nome,
    setores: ord(u.setores.values()).map((s) => ({ codigo: s.codigo, nome: s.nome, cargos: ord(s.cargos.values()) })),
  }));
  if (!livre) return { unidades: arvore };
  // Sem filtro de hierarquia: listas independentes
  const setores = new Map<string, C>(); const cargos = new Map<string, C>();
  for (const u of arvore) for (const s of u.setores) { setores.set(s.codigo, { codigo: s.codigo, nome: s.nome }); for (const c of s.cargos) cargos.set(c.codigo, c); }
  return { unidades: arvore.map((u) => ({ codigo: u.codigo, nome: u.nome, setores: [] })), setores: ord(setores.values()), cargos: ord(cargos.values()) };
}

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
  const t = text.trim();
  if (!t || /^"?sem resultado"?$/i.test(t)) return [];
  try { const p = JSON.parse(t); return Array.isArray(p) ? p : (p?.data ?? []); }
  catch { console.error('SOC resposta', text.slice(0, 300)); return null; }
}

const inativoRow = (r: Row) => /inativ|demit/i.test(pick(r, ['SITUACAO', 'SITUACAOFUNCIONARIO']) ?? '');

// Retorna o vínculo ativo; se só houver histórico inativo, retorna o mais recente marcado como inativo
async function buscarFuncionario(socCode: string, cpf: string): Promise<{ row: Row; inativo: boolean } | false | null> {
  const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
  const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_FUNCIONARIO');
  const chave = Deno.env.get('SOC_CHAVE_EXPORTA_FUNCIONARIO');
  if (!empresa || !codigo || !chave) return null;
  const rows = await exporta({
    empresa, codigo, chave, empresaTrabalho: socCode, cpf,
    ativo: 'Sim', inativo: 'Sim', afastado: 'Sim', pendente: 'Sim', ferias: 'Sim',
  });
  if (!rows) return null;
  const doCpf = rows.filter((r) => (pick(r, ['CPF', 'CPFFUNCIONARIO']) ?? '').replace(/\D/g, '').padStart(11, '0') === cpf);
  const ativo = doCpf.find((r) => !inativoRow(r));
  if (ativo) return { row: ativo, inativo: false };
  if (!doCpf.length) return false;
  const ultimo = [...doCpf].sort((a, b) => Number(pick(b, ['CODIGO']) ?? 0) - Number(pick(a, ['CODIGO']) ?? 0))[0];
  return { row: ultimo, inativo: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Dados inválidos' }, 400);
    const b = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: empresas } = await admin.from('companies')
      .select('soc_code, razao_social, nome_abreviado, cidade, estado, subgrupo')
      .eq('cnpj', b.cnpj).eq('is_active', true).order('razao_social');

    if (b.acao === 'empresa') return json({ empresas: (empresas ?? []).map(({ subgrupo, ...e }) => ({ ...e, podeCriar: podeCriar(subgrupo) })) });

    // Só consulta colaborador de empresa ativa vinculada ao CNPJ informado
    const emp = empresas?.find((e) => e.soc_code === b.socCode);
    if (!emp) return json({ error: 'Empresa inválida' }, 400);
    const livre = podeCriar(emp.subgrupo);

    if (b.acao === 'hierarquia') {
      const h = await hierarquia(b.socCode, livre);
      return json(h ? { ...h, podeCriar: livre } : { indisponivel: true, podeCriar: livre });
    }

    if (b.acao === 'cadastrar') {
      const existente = await buscarFuncionario(b.socCode, b.cpf);
      if (existente) return json({ error: 'Este CPF já possui cadastro nesta empresa.' }, 409);
      if (!livre) {
        // Empresas com laudos: só aceita unidade/setor/cargo existentes e amarrados na hierarquia
        const h = await hierarquia(b.socCode, false);
        const u = h?.unidades.find((x) => x.codigo === b.unidade.codigo);
        const st = u?.setores.find((x) => x.codigo === b.setor.codigo);
        if (!st?.cargos.some((x) => x.codigo === b.cargo.codigo)) return json({ error: 'Selecione unidade, setor e cargo existentes na hierarquia da empresa.' }, 400);
      }
      const r = await cadastrarFuncionarioSoc({ ...b, codigoEmpresa: b.socCode, podeCriar: livre });
      if (!r.ok) return json({ error: `O SOC recusou o cadastro: ${r.erro ?? 'erro desconhecido'}` }, 422);
      return json({ ok: true, codigoFuncionario: r.codigoFuncionario });
    }

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
