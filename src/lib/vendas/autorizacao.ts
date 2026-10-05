// Autorização de pagamento de comissão (PDF/Excel) para a contabilidade.
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { brl, taxaItem } from './skywork';

const db = supabase as any;
const fmt = (d: string | null) => (d ? format(parseISO(d), 'dd/MM/yyyy') : '—');
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

interface Linha { numero: string; data: string; cliente: string; cnpj: string; fatura: string; nfse: string; valor: number; divisao: number; semComissao: number; base: number; taxa: number; comissao: number; servicos: string }

async function carregar(fechamentoId: string) {
  const { data: f, error } = await db.from('vendas_fechamentos').select('*').eq('id', fechamentoId).single();
  if (error) throw error;
  let autor = f.autorizado_por_nome as string | null;
  if (!autor && f.created_by) {
    const { data: p } = await db.from('profiles').select('full_name').eq('id', f.created_by).maybeSingle();
    autor = p?.full_name || null;
  }
  const { data: fi, error: e2 } = await db.from('vendas_fechamento_itens').select('venda_id,vendedor,base,comissao').eq('fechamento_id', fechamentoId);
  if (e2) throw e2;
  const ids = (fi || []).map((i: any) => i.venda_id);
  const [{ data: vendas }, { data: itens }] = await Promise.all([
    db.from('vendas').select('id,numero_venda,data_venda,cliente_nome,cliente_cnpj,fatura,nfse,valor').in('id', ids),
    db.from('venda_itens').select('venda_id,nome,valor_total,tipo_comissao,taxa_personalizada').in('venda_id', ids),
  ]);
  const vMap = new Map<string, any>((vendas || []).map((v: any) => [v.id, v]));
  const linhas: Linha[] = (fi || []).map((i: any) => {
    const v = vMap.get(i.venda_id) || {};
    const its = (itens || []).filter((x: any) => x.venda_id === i.venda_id);
    const valor = Number(v.valor || 0);
    const base = Number(i.base);
    const divisao = valor ? base / valor : 1;
    const sem = its.filter((x: any) => x.tipo_comissao === 'sem_comissao').reduce((s: number, x: any) => s + Number(x.valor_total || 0), 0) * divisao;
    const servicos = its.map((x: any) => `${x.nome} (${pct(taxaItem(x, v.data_venda))})`).join('; ');
    const com = Number(i.comissao);
    return { numero: v.numero_venda, data: fmt(v.data_venda), cliente: v.cliente_nome || '', cnpj: v.cliente_cnpj || '', fatura: v.fatura || '', nfse: v.nfse || '', valor, divisao, semComissao: sem, base, taxa: base ? com / base : 0, comissao: com, servicos };
  }).sort((a: Linha, b: Linha) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
  const tot = {
    faturado: linhas.reduce((s, l) => s + l.base, 0),
    sem: linhas.reduce((s, l) => s + l.semComissao, 0),
    comissao: linhas.reduce((s, l) => s + l.comissao, 0),
  };
  return { f, autor: autor || 'Não identificado', linhas, tot: { ...tot, base: tot.faturado - tot.sem } };
}

const nomeArquivo = (f: any, ext: string) => `autorizacao-comissao-${String(f.vendedor).replace(/\s+/g, '_')}-${f.periodo_ini}_a_${f.periodo_fim}.${ext}`;

export async function gerarAutorizacaoPDF(fechamentoId: string) {
  const [{ f, autor, linhas, tot }, { default: jsPDF }, { default: autoTable }, logo] = await Promise.all([
    carregar(fechamentoId), import('jspdf'), import('jspdf-autotable'), import('@/assets/logo-prevermed.png'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  try { doc.addImage(logo.default, 'PNG', 14, 10, 40, 14); } catch { /* sem logo */ }
  doc.setFontSize(15); doc.text('Autorização de Pagamento de Comissão', W - 14, 16, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`Vendedor: ${f.vendedor}`, 14, 32);
  doc.text(`Período de competência: ${fmt(f.periodo_ini)} a ${fmt(f.periodo_fim)}`, 14, 38);
  doc.text(`Pagamento autorizado por: ${autor} em ${format(new Date(f.created_at), "dd/MM/yyyy 'às' HH:mm")}`, 14, 44);

  autoTable(doc, {
    startY: 50, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [30, 80, 150] }, tableWidth: 150,
    head: [['Resumo', 'Valor']],
    body: [['Total faturado', brl(tot.faturado)], ['Não comissionável (0%)', brl(tot.sem)], ['Base de cálculo', brl(tot.base)], ['Total líquido a pagar', brl(tot.comissao)], ['Quantidade de vendas', String(linhas.length)]],
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6, theme: 'striped', styles: { fontSize: 7, cellPadding: 1.2 }, headStyles: { fillColor: [30, 80, 150] },
    head: [['Nº Venda', 'Data', 'Cliente', 'Fatura', 'NFS-e', 'Valor', 'Sem comissão', 'Taxa efetiva', 'Comissão', 'Serviços (alíquota)']],
    body: linhas.map(l => [l.numero, l.data, l.cliente, l.fatura, l.nfse, brl(l.base), brl(l.semComissao), pct(l.taxa), brl(l.comissao), l.servicos]),
    columnStyles: { 2: { cellWidth: 45 }, 9: { cellWidth: 80 } },
  });
  let y = (doc as any).lastAutoTable.finalY + 25;
  if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 40; }
  const cols = ['Gestor (autorização)', 'Financeiro', 'Vendedor'];
  cols.forEach((c, i) => {
    const x = 14 + i * ((W - 28) / 3);
    doc.line(x, y, x + 70, y); doc.setFontSize(9); doc.text(c, x, y + 5);
  });
  doc.save(nomeArquivo(f, 'pdf'));
}

export async function gerarAutorizacaoExcel(fechamentoId: string) {
  const [{ f, autor, linhas, tot }, XLSX] = await Promise.all([carregar(fechamentoId), import('xlsx')]);
  const resumo = [
    ['Autorização de Pagamento de Comissão'], [],
    ['Vendedor', f.vendedor], ['Período', `${fmt(f.periodo_ini)} a ${fmt(f.periodo_fim)}`],
    ['Autorizado por', autor], ['Data da autorização', format(new Date(f.created_at), 'dd/MM/yyyy HH:mm')], [],
    ['Total faturado', tot.faturado], ['Não comissionável (0%)', tot.sem], ['Base de cálculo', tot.base], ['Total líquido a pagar', tot.comissao], ['Quantidade de vendas', linhas.length],
  ];
  const analitico = [
    ['Nº Venda', 'Data', 'Cliente', 'CNPJ', 'Fatura', 'NFS-e', 'Valor venda', '% divisão', 'Valor do vendedor', 'Sem comissão', 'Taxa efetiva', 'Comissão', 'Serviços (alíquota)'],
    ...linhas.map(l => [l.numero, l.data, l.cliente, l.cnpj, l.fatura, l.nfse, l.valor, Math.round(l.divisao * 10000) / 100, l.base, l.semComissao, Math.round(l.taxa * 10000) / 100, l.comissao, l.servicos]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(analitico), 'Analítico');
  XLSX.writeFile(wb, nomeArquivo(f, 'xlsx'));
}
