import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SkyworkVenda } from '@/lib/vendas/skywork';

export interface Venda {
  id: string;
  emitente_cnpj: string;
  emitente_nome: string | null;
  numero_venda: string;
  data_venda: string | null;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
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
  cidade: string | null;
  estado: string | null;
  tipo_comissao: 'renovacao' | 'novo';
  divisao: any;
  validado: boolean;
  validado_em: string | null;
  marcado_novo_em: string | null;
}

const db = supabase as any;

export function useVendas() {
  return useQuery({
    queryKey: ['vendas'],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Venda[]> => {
      const all: Venda[] = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        const { data, error } = await db.from('vendas')
          .select('id,emitente_cnpj,emitente_nome,numero_venda,data_venda,cliente_nome,cliente_cnpj,valor,vendedor_original,vendedor,vendedores,compartilhada,situacao,descricao,fatura,nfse,forma_pagamento,cidade,estado,tipo_comissao,divisao,validado,validado_em,marcado_novo_em')
          // Só equipe comercial: Faturamento e sem vendedor nunca são baixados
          .not('vendedor', 'is', null)
          .neq('vendedor', 'Faturamento')
          .order('data_venda', { ascending: false })
          .order('numero_venda', { ascending: false })
          .range(from, from + size - 1);
        if (error) throw error;
        all.push(...(data || []).map((v: any) => ({ ...v, valor: Number(v.valor) })));
        if (!data || data.length < size) break;
      }
      return all;
    },
  });
}

export function useVendaItens(vendaId: string | null) {
  return useQuery({
    queryKey: ['venda-itens', vendaId],
    enabled: !!vendaId,
    queryFn: async () => {
      const { data, error } = await db.from('venda_itens').select('*').eq('venda_id', vendaId).order('ordem');
      if (error) throw error;
      return data as any[];
    },
  });
}

export interface VendaItem { id: string; venda_id: string; ordem: number; nome: string | null; quantidade: number | null; valor_unitario: number | null; valor_total: number | null; tipo_comissao: string }

async function fetchAll(table: string, cols: string) {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).order('id').range(from, from + 999);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

/** Todos os itens agrupados por venda (para comissão por serviço). */
export function useTodosItens() {
  return useQuery({
    queryKey: ['venda-itens', 'todos'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // Só itens das vendas da equipe comercial (filtro feito no banco)
      const rows: VendaItem[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from('venda_itens')
          .select('id,venda_id,ordem,nome,quantidade,valor_unitario,valor_total,tipo_comissao,vendas!inner(vendedor)')
          .not('vendas.vendedor', 'is', null)
          .neq('vendas.vendedor', 'Faturamento')
          .order('id').range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []).map(({ vendas, ...r }: any) => r));
        if (!data || data.length < 1000) break;
      }
      const m = new Map<string, VendaItem[]>();
      rows.forEach(r => { const a = m.get(r.venda_id) || []; a.push({ ...r, valor_total: Number(r.valor_total) }); m.set(r.venda_id, a); });
      m.forEach(a => a.sort((x, y) => x.ordem - y.ordem));
      return m;
    },
  });
}

export function useFechamentos() {
  return useQuery({
    queryKey: ['vendas-fechamentos'],
    queryFn: async () => {
      const [fech, itens] = await Promise.all([
        db.from('vendas_fechamentos').select('*').order('created_at', { ascending: false }),
        fetchAll('vendas_fechamento_itens', 'id,fechamento_id,venda_id,vendedor'),
      ]);
      if (fech.error) throw fech.error;
      const fechados = new Map<string, string>(); // `${venda_id}|${vendedor}` -> fechamento_id
      itens.forEach((i: any) => fechados.set(`${i.venda_id}|${i.vendedor}`, i.fechamento_id));
      return { lista: (fech.data || []) as any[], fechados, vendasFechadas: new Set(itens.map((i: any) => i.venda_id as string)) };
    },
  });
}

export function useVendasImportacoes() {
  return useQuery({
    queryKey: ['vendas-importacoes'],
    queryFn: async () => {
      const { data, error } = await db.from('vendas_importacoes').select('*').order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useInvalidateVendas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['vendas'] });
    qc.invalidateQueries({ queryKey: ['vendas-importacoes'] });
    qc.invalidateQueries({ queryKey: ['venda-itens'] });
    qc.invalidateQueries({ queryKey: ['vendas-fechamentos'] });
  };
}

export async function importarVendas(
  vendas: SkyworkVenda[],
  arquivoNome: string,
  userId: string | null,
  onProgress?: (p: number) => void,
) {
  // Chaves já existentes
  const existentes = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('vendas').select('emitente_cnpj,numero_venda').range(from, from + 999);
    if (error) throw error;
    (data || []).forEach((r: any) => existentes.add(`${r.emitente_cnpj}|${r.numero_venda}`));
    if (!data || data.length < 1000) break;
  }
  const inseridas = vendas.filter(v => !existentes.has(`${v.emitente_cnpj}|${v.numero_venda}`)).length;

  const { data: imp, error: impErr } = await db.from('vendas_importacoes')
    .insert({ arquivo_nome: arquivoNome, total_vendas: vendas.length, inseridas, atualizadas: vendas.length - inseridas, created_by: userId })
    .select().single();
  if (impErr) throw impErr;

  const lote = 300;
  for (let i = 0; i < vendas.length; i += lote) {
    const chunk = vendas.slice(i, i + lote);
    // Upsert só com colunas de importação — tipo de comissão, divisão e validação são preservados
    const payload = chunk.map(({ itens, ...v }) => ({ ...v, importacao_id: imp.id }));
    const { data: saved, error } = await db.from('vendas')
      .upsert(payload, { onConflict: 'emitente_cnpj,numero_venda' })
      .select('id,emitente_cnpj,numero_venda');
    if (error) throw error;
    const idPorChave = new Map<string, string>((saved || []).map((s: any) => [`${s.emitente_cnpj}|${s.numero_venda}`, s.id]));
    const ids = Array.from(idPorChave.values());
    const { data: antigos } = await db.from('venda_itens').select('venda_id,ordem,tipo_comissao').in('venda_id', ids);
    const tipoAntigo = new Map<string, string>((antigos || []).map((a: any) => [`${a.venda_id}|${a.ordem}`, a.tipo_comissao]));
    const { error: delErr } = await db.from('venda_itens').delete().in('venda_id', ids);
    if (delErr) throw delErr;
    const itens = chunk.flatMap(v => v.itens.map(it => {
      const vid = idPorChave.get(`${v.emitente_cnpj}|${v.numero_venda}`);
      return { ...it, venda_id: vid, tipo_comissao: tipoAntigo.get(`${vid}|${it.ordem}`) || 'pendente' };
    }));
    for (let j = 0; j < itens.length; j += 1000) {
      const { error: itErr } = await db.from('venda_itens').insert(itens.slice(j, j + 1000));
      if (itErr) throw itErr;
    }
    onProgress?.(Math.min(100, Math.round(((i + chunk.length) / vendas.length) * 100)));
  }
  return { total: vendas.length, inseridas, atualizadas: vendas.length - inseridas };
}
