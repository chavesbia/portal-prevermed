// Parser da exportação "Vendas" do Skywork (CSV ; em ISO-8859-1).
// Cada venda ocupa uma linha de cabeçalho seguida de linhas de itens com campos da venda vazios.

export const PREVERMED_CNPJ_PADRAO = '28.309.721/0001-05';
export const VENDEDOR_FATURAMENTO = 'Faturamento';
export const TAXA_NOVO = 0.03;
export const TAXA_RENOVACAO = 0.01;

export interface SkyworkItem {
  ordem: number;
  sku: string | null;
  nome: string | null;
  descricao: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  desconto: number | null;
  valor_total: number | null;
}

export interface SkyworkVenda {
  emitente_cnpj: string;
  emitente_nome: string | null;
  numero_venda: string;
  data_venda: string | null;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  cliente_telefone: string | null;
  cliente_desde: string | null;
  qtd_vendas_cliente: number | null;
  valor: number;
  vendedor_original: string | null;
  vendedor: string | null;
  vendedores: string[];
  compartilhada: boolean;
  situacao: string | null;
  descricao: string | null;
  fatura: string | null;
  nfse: string | null;
  forma_pagamento: string | null;
  condicao_pagamento: string | null;
  estado: string | null;
  cidade: string | null;
  grupo_vendedor: string | null;
  itens: SkyworkItem[];
}

function parseCsv(text: string, sep = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (v: string | undefined) => {
  if (v == null) return null;
  let s = v.trim();
  if (s.startsWith('=')) s = s.slice(1).replace(/^"|"$/g, '');
  if (!s || s === '-') return null;
  return s;
};

const num = (v: string | undefined): number | null => {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

const date = (v: string | undefined): string | null => {
  const s = clean(v);
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

const DOC_RE = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/;

function parseCliente(v: string | undefined) {
  const s = clean(v);
  if (!s) return { nome: null, doc: null, tel: null };
  const m = s.match(DOC_RE);
  if (!m) return { nome: s, doc: null, tel: null };
  const idx = s.indexOf(m[0]);
  const nome = s.slice(0, idx).replace(/\s*-\s*$/, '').trim() || null;
  const tel = s.slice(idx + m[0].length).replace(/^\s*-\s*/, '').trim() || null;
  return { nome, doc: m[0], tel };
}

function parseEmitente(v: string | undefined) {
  const s = clean(v) || 'PreverMed';
  const m = s.match(/^([\d./-]+)\s*\|\s*(.+)$/);
  if (m) return { cnpj: m[1].trim(), nome: m[2].replace(/\s+/g, ' ').trim() };
  return { cnpj: PREVERMED_CNPJ_PADRAO, nome: 'PREVERMED' };
}

export function parseSkyworkVendas(text: string): SkyworkVenda[] {
  const rows = parseCsv(text);
  const header = rows[0]?.map(h => h.trim()) ?? [];
  if (!header.some(h => /da Venda/i.test(h)) || header.length < 26) {
    throw new Error('Arquivo não reconhecido. Use a exportação "Vendas" do Skywork em CSV.');
  }
  const vendas: SkyworkVenda[] = [];
  let atual: SkyworkVenda | null = null;
  for (const r of rows.slice(1)) {
    if (r.length < 26) continue;
    if (clean(r[1])) {
      const emit = parseEmitente(r[0]);
      const cli = parseCliente(r[3]);
      const vendOrig = clean(r[7]);
      const vendedores = (vendOrig || '').split(',').map(s => s.trim()).filter(Boolean);
      atual = {
        emitente_cnpj: emit.cnpj,
        emitente_nome: emit.nome,
        numero_venda: clean(r[1])!,
        data_venda: date(r[2]),
        cliente_nome: cli.nome,
        cliente_cnpj: cli.doc,
        cliente_telefone: cli.tel,
        cliente_desde: date(r[4]),
        qtd_vendas_cliente: num(r[5]),
        valor: num(r[6]) ?? 0,
        vendedor_original: vendOrig,
        vendedor: vendedores[0] ?? null,
        vendedores,
        compartilhada: vendedores.length > 1,
        situacao: clean(r[8]),
        descricao: clean(r[9]),
        fatura: clean(r[10]),
        nfse: clean(r[11]),
        forma_pagamento: clean(r[12]),
        estado: clean(r[13]),
        cidade: clean(r[14]),
        grupo_vendedor: clean(r[18]),
        condicao_pagamento: clean(r[28]),
        itens: [],
      };
      vendas.push(atual);
    }
    if (atual && (clean(r[19]) || clean(r[20]))) {
      atual.itens.push({
        ordem: atual.itens.length,
        sku: clean(r[19]),
        nome: clean(r[20]),
        descricao: clean(r[21]),
        quantidade: num(r[22]),
        valor_unitario: num(r[23]),
        desconto: num(r[24]),
        valor_total: num(r[25]),
      });
    }
  }
  return vendas;
}

export async function readSkyworkFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf8.includes('\uFFFD')) return utf8;
  return new TextDecoder('iso-8859-1').decode(buf);
}

/** Venda que conta para comissão: concluída, com vendedor real (não Faturamento). */
export function isComissionavel(v: { situacao: string | null; vendedor: string | null }) {
  return v.situacao === 'Concluído' && !!v.vendedor && v.vendedor !== VENDEDOR_FATURAMENTO;
}

export type Divisao = { vendedor: string; percentual: number }[];

/** Distribui a comissão da venda entre vendedores (padrão: 100% primeiro vendedor). */
export function comissaoPorVendedor(v: { valor: number; tipo_comissao: string; vendedor: string | null; divisao: any }) {
  const taxa = v.tipo_comissao === 'novo' ? TAXA_NOVO : TAXA_RENOVACAO;
  const div: Divisao = Array.isArray(v.divisao) && v.divisao.length ? v.divisao : (v.vendedor ? [{ vendedor: v.vendedor, percentual: 100 }] : []);
  return div.map(d => ({ vendedor: d.vendedor, percentual: d.percentual, base: Number(v.valor) * d.percentual / 100, comissao: Number(v.valor) * taxa * d.percentual / 100, taxa }));
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
