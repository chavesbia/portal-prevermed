import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Venda, VendaItem, useTodosItens } from '@/hooks/useVendas';
import { brl } from '@/lib/vendas/skywork';
import { titleCase } from '@/lib/vendas/audit';

const PAGE = 50;
const fmt = (d: string | null) => (d ? format(parseISO(d), 'dd/MM/yyyy') : '—');

export function VendaVendedorBadge({ v }: { v: Venda }) {
  if (!v.vendedor) return <Badge variant="destructive" className="whitespace-nowrap">Sem vendedor</Badge>;
  return (
    <span className="whitespace-nowrap">
      {v.vendedor}
      {v.compartilhada && <Badge variant="outline" className="ml-1 whitespace-nowrap text-[10px]">+{v.vendedores.length - 1}</Badge>}
    </span>
  );
}

export function VendasList({ vendas, situacao, onSituacao, page, onPage }: {
  vendas: Venda[]; situacao: string; onSituacao: (s: string) => void; page: number; onPage: (p: number) => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const { data: itensMap } = useTodosItens();
  const situacoes = useMemo(() => Array.from(new Set(vendas.map(v => v.situacao).filter(Boolean) as string[])).sort(), [vendas]);
  const lista = useMemo(() => situacao === 'all' ? vendas : vendas.filter(v => v.situacao === situacao), [vendas, situacao]);
  const pages = Math.max(1, Math.ceil(lista.length / PAGE));
  const cur = Math.min(page, pages);
  const pag = lista.slice((cur - 1) * PAGE, cur * PAGE);
  const total = lista.reduce((s, v) => s + v.valor, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={situacao} onValueChange={onSituacao}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {situacoes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{lista.length} vendas · {brl(total)}</span>
      </div>

      <div className="rounded-md border overflow-auto max-h-[65vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="text-left">
              {['Nº Venda', 'Data', 'Cliente', 'Emitente', 'Vendedor', 'Situação', 'Fatura', 'NFS-e', 'Valor'].map((h, i) => (
                <th key={h} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 bg-muted' : ''} ${h === 'Valor' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pag.map(v => (
              <Fragment key={v.id}>
              <tr className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => setAberta(aberta === v.id ? null : v.id)}>
                <td className="px-3 py-2 sticky left-0 bg-background font-medium whitespace-nowrap">
                  {aberta === v.id ? <ChevronDown className="inline h-4 w-4 mr-1" /> : <ChevronRight className="inline h-4 w-4 mr-1" />}{v.numero_venda}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{fmt(v.data_venda)}</td>
                <td className="px-3 py-2 min-w-[240px]">
                  <div>{titleCase(v.cliente_nome)}</div>
                  <div className="text-xs text-muted-foreground">{v.cliente_cnpj}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{v.emitente_cnpj}</td>
                <td className="px-3 py-2"><VendaVendedorBadge v={v} /></td>
                <td className="px-3 py-2"><Badge variant="secondary" className="whitespace-nowrap">{v.situacao || '—'}</Badge></td>
                <td className="px-3 py-2">{v.fatura || '—'}</td>
                <td className="px-3 py-2">{v.nfse || '—'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{brl(v.valor)}</td>
              </tr>
              {aberta === v.id && (
                <tr className="bg-muted/30"><td colSpan={9} className="px-6 py-3">
                  <VendaDetalheInline venda={v} itens={itensMap?.get(v.id) || []} />
                </td></tr>
              )}
              </Fragment>
            ))}
            {pag.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhuma venda encontrada.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={cur <= 1} onClick={() => onPage(cur - 1)}>Anterior</Button>
        <span className="text-sm text-muted-foreground">Página {cur} de {pages}</span>
        <Button variant="outline" size="sm" disabled={cur >= pages} onClick={() => onPage(cur + 1)}>Próxima</Button>
      </div>

    </div>
  );
}

export function TipoTag({ tipo }: { tipo: string }) {
  return tipo === 'novo'
    ? <Badge className="whitespace-nowrap bg-success text-success-foreground hover:bg-success">Novo 3%</Badge>
    : <Badge variant="secondary" className="whitespace-nowrap">Renovação 1%</Badge>;
}

function VendaDetalheInline({ venda, itens }: { venda: Venda; itens: VendaItem[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Info label="Vendedor(es)" value={venda.vendedor_original || 'Sem vendedor'} />
        <Info label="Pagamento" value={venda.forma_pagamento} />
        <Info label="Cidade" value={[venda.cidade, venda.estado].filter(Boolean).join(' / ')} />
        <Info label="Emitente" value={venda.emitente_nome} />
        {venda.descricao && <Info label="Descrição" value={venda.descricao} full />}
      </div>
      <table className="w-full text-sm border rounded-md bg-background">
        <thead><tr className="text-left bg-muted"><th className="px-2 py-1">Serviço</th><th className="px-2 py-1 text-right">Qtd</th><th className="px-2 py-1 text-right">Unitário</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1">Comissão</th></tr></thead>
        <tbody>
          {itens.map(it => (
            <tr key={it.id} className="border-t">
              <td className="px-2 py-1">{it.nome}</td>
              <td className="px-2 py-1 text-right">{Number(it.quantidade || 0).toLocaleString('pt-BR')}</td>
              <td className="px-2 py-1 text-right whitespace-nowrap">{brl(Number(it.valor_unitario || 0))}</td>
              <td className="px-2 py-1 text-right whitespace-nowrap">{brl(Number(it.valor_total || 0))}</td>
              <td className="px-2 py-1"><TipoTag tipo={it.tipo_comissao} /></td>
            </tr>
          ))}
          {itens.length === 0 && <tr><td colSpan={5} className="p-2 text-muted-foreground">Sem serviços.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Info({ label, value, full }: { label: string; value: string | null | undefined; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || '—'}</div>
    </div>
  );
}
