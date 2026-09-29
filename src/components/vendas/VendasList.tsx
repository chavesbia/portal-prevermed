import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';
import { Venda, useVendaItens } from '@/hooks/useVendas';
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
  const [sel, setSel] = useState<Venda | null>(null);
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
              <tr key={v.id} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => setSel(v)}>
                <td className="px-3 py-2 sticky left-0 bg-background font-medium">{v.numero_venda}</td>
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

      <VendaDetalhe venda={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function VendaDetalhe({ venda, onClose }: { venda: Venda | null; onClose: () => void }) {
  const { data: itens, isLoading } = useVendaItens(venda?.id ?? null);
  return (
    <Sheet open={!!venda} onOpenChange={o => !o && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        {venda && (
          <>
            <SheetHeader><SheetTitle>Venda {venda.numero_venda}</SheetTitle></SheetHeader>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="Cliente" value={`${titleCase(venda.cliente_nome)}${venda.cliente_cnpj ? ` — ${venda.cliente_cnpj}` : ''}`} full />
              <Info label="Emitente" value={`${venda.emitente_cnpj} — ${venda.emitente_nome || ''}`} full />
              <Info label="Data" value={fmt(venda.data_venda)} />
              <Info label="Situação" value={venda.situacao} />
              <Info label="Vendedor(es)" value={venda.vendedor_original || 'Sem vendedor'} />
              <Info label="Valor" value={brl(venda.valor)} />
              <Info label="Fatura" value={venda.fatura} />
              <Info label="NFS-e" value={venda.nfse} />
              <Info label="Pagamento" value={venda.forma_pagamento} />
              <Info label="Cidade" value={[venda.cidade, venda.estado].filter(Boolean).join(' / ')} />
              <Info label="Descrição" value={venda.descricao} full />
            </div>
            <h4 className="font-semibold mt-6 mb-2">Serviços</h4>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <div className="rounded-md border divide-y">
                {(itens || []).map(it => (
                  <div key={it.id} className="p-2 text-sm flex justify-between gap-3">
                    <div>
                      <div className="font-medium">{it.nome}</div>
                      <div className="text-xs text-muted-foreground">Qtd {Number(it.quantidade || 0).toLocaleString('pt-BR')} × {brl(Number(it.valor_unitario || 0))}</div>
                    </div>
                    <div className="whitespace-nowrap">{brl(Number(it.valor_total || 0))}</div>
                  </div>
                ))}
                {(itens || []).length === 0 && <div className="p-3 text-sm text-muted-foreground">Sem itens.</div>}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
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
