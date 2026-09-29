import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Download, Split, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Venda, useInvalidateVendas } from '@/hooks/useVendas';
import { brl, comissaoPorVendedor, isComissionavel, Divisao } from '@/lib/vendas/skywork';
import { auditVendas, titleCase } from '@/lib/vendas/audit';
import { VendaVendedorBadge } from './VendasList';

const db = supabase as any;

export function VendasComissoes({ vendas, canEdit, canApprove }: { vendas: Venda[]; canEdit: boolean; canApprove: boolean }) {
  const { user } = useAuth();
  const invalidate = useInvalidateVendas();
  const [dividir, setDividir] = useState<Venda | null>(null);
  const [soPendentes, setSoPendentes] = useState(false);

  const elegiveis = useMemo(() => vendas.filter(isComissionavel), [vendas]);
  const semVendedor = useMemo(() => vendas.filter(v => v.situacao === 'Concluído' && !v.vendedor), [vendas]);
  const lista = soPendentes ? elegiveis.filter(v => !v.validado) : elegiveis;

  const porVendedor = useMemo(() => {
    const m = new Map<string, { base: number; novo: number; renov: number; comissao: number; pend: number }>();
    elegiveis.forEach(v => comissaoPorVendedor(v).forEach(c => {
      const r = m.get(c.vendedor) || { base: 0, novo: 0, renov: 0, comissao: 0, pend: 0 };
      r.base += c.base; r.comissao += c.comissao;
      if (v.tipo_comissao === 'novo') r.novo += c.base; else r.renov += c.base;
      if (!v.validado) r.pend += 1;
      m.set(c.vendedor, r);
    }));
    return Array.from(m.entries()).sort((a, b) => b[1].comissao - a[1].comissao);
  }, [elegiveis]);

  const atualizar = async (v: Venda, patch: Record<string, unknown>, acao: string) => {
    const { error } = await db.from('vendas').update(patch).eq('id', v.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await auditVendas(user?.id, acao, v.id, { numero_venda: v.numero_venda, ...patch });
    invalidate();
  };

  const validarTodas = async () => {
    const ids = lista.filter(v => !v.validado).map(v => v.id);
    if (!ids.length) return;
    const { error } = await db.from('vendas').update({ validado: true }).in('id', ids);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await auditVendas(user?.id, 'validar_comissoes_lote', null, { quantidade: ids.length });
    toast({ title: 'Comissões validadas', description: `${ids.length} vendas.` });
    invalidate();
  };

  const exportar = () => {
    const linhas = [['Vendedor', 'Nº Venda', 'Data', 'Cliente', 'CNPJ Cliente', 'Emitente', 'Fatura', 'NFS-e', 'Valor venda', '% divisão', 'Base', 'Tipo', 'Taxa', 'Comissão', 'Validado']];
    elegiveis.forEach(v => comissaoPorVendedor(v).forEach(c => linhas.push([
      c.vendedor, v.numero_venda, v.data_venda ? format(parseISO(v.data_venda), 'dd/MM/yyyy') : '', v.cliente_nome || '', v.cliente_cnpj || '',
      v.emitente_cnpj, v.fatura || '', v.nfse || '', v.valor.toFixed(2).replace('.', ','), String(c.percentual),
      c.base.toFixed(2).replace('.', ','), v.tipo_comissao === 'novo' ? 'Serviço Novo' : 'Renovação', `${c.taxa * 100}%`,
      c.comissao.toFixed(2).replace('.', ','), v.validado ? 'Sim' : 'Não',
    ])));
    const csv = '\uFEFF' + linhas.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `comissoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {semVendedor.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <strong>{semVendedor.length}</strong> vendas concluídas estão sem vendedor e não entram na comissão. Corrija no Skywork e importe novamente.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {porVendedor.map(([nome, r]) => (
          <Card key={nome}>
            <CardContent className="pt-4 space-y-1 text-sm">
              <div className="font-semibold">{nome}</div>
              <div className="text-2xl font-bold">{brl(r.comissao)}</div>
              <div className="text-xs text-muted-foreground">Vendido {brl(r.base)}</div>
              <div className="text-xs">Novo (3%): {brl(r.novo)} · Renovação (1%): {brl(r.renov)}</div>
              {r.pend > 0 ? <Badge variant="outline" className="whitespace-nowrap">{r.pend} a validar</Badge> : <Badge className="whitespace-nowrap">Tudo validado</Badge>}
            </CardContent>
          </Card>
        ))}
        {porVendedor.length === 0 && <div className="text-muted-foreground text-sm">Nenhuma venda comissionável no período.</div>}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={soPendentes} onCheckedChange={c => setSoPendentes(!!c)} /> Somente não validadas</label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportar}><Download className="h-4 w-4 mr-2" />Exportar</Button>
          {canApprove && <Button onClick={validarTodas}><CheckCircle2 className="h-4 w-4 mr-2" />Validar todas exibidas</Button>}
        </div>
      </div>

      <div className="rounded-md border overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="text-left">
              {['Nº Venda', 'Data', 'Cliente', 'Vendedor', 'Valor', 'Tipo', 'Comissão', 'Divisão', 'Validado'].map((h, i) => (
                <th key={h} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 bg-muted' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(v => {
              const com = comissaoPorVendedor(v).reduce((s, c) => s + c.comissao, 0);
              const bloqueado = v.validado && !canApprove;
              return (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2 sticky left-0 bg-background font-medium">{v.numero_venda}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{v.data_venda ? format(parseISO(v.data_venda), 'dd/MM/yyyy') : '—'}</td>
                  <td className="px-3 py-2 min-w-[220px]">{titleCase(v.cliente_nome)}</td>
                  <td className="px-3 py-2"><VendaVendedorBadge v={v} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{brl(v.valor)}</td>
                  <td className="px-3 py-2">
                    <div className="inline-flex rounded-md border overflow-hidden">
                      {(['renovacao', 'novo'] as const).map(t => (
                        <button key={t} disabled={!canEdit || bloqueado}
                          onClick={() => v.tipo_comissao !== t && atualizar(v, { tipo_comissao: t }, 'tipo_comissao')}
                          className={`px-2 py-1 text-xs whitespace-nowrap disabled:cursor-not-allowed ${v.tipo_comissao === t ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}>
                          {t === 'novo' ? 'Novo 3%' : 'Renovação 1%'}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{brl(com)}</td>
                  <td className="px-3 py-2">
                    {v.compartilhada || Array.isArray(v.divisao) ? (
                      <Button variant="ghost" size="sm" disabled={!canEdit || bloqueado} onClick={() => setDividir(v)}>
                        <Split className="h-4 w-4 mr-1" />{Array.isArray(v.divisao) ? 'Dividida' : 'Dividir?'}
                      </Button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Checkbox checked={v.validado} disabled={!canApprove} onCheckedChange={c => atualizar(v, { validado: !!c }, c ? 'validar_comissao' : 'desvalidar_comissao')} />
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhuma venda.</td></tr>}
          </tbody>
        </table>
      </div>

      {dividir && <DivisaoDialog venda={dividir} onClose={() => setDividir(null)} onSave={d => { atualizar(dividir, { divisao: d }, 'divisao_comissao'); setDividir(null); }} />}
    </div>
  );
}

function DivisaoDialog({ venda, onClose, onSave }: { venda: Venda; onClose: () => void; onSave: (d: Divisao | null) => void }) {
  const inicial: Divisao = Array.isArray(venda.divisao) ? venda.divisao
    : venda.vendedores.map((n, i) => ({ vendedor: n, percentual: i === 0 ? 100 : 0 }));
  const [div, setDiv] = useState<Divisao>(inicial);
  const soma = div.reduce((s, d) => s + (Number(d.percentual) || 0), 0);
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dividir comissão — venda {venda.numero_venda}</DialogTitle>
          <DialogDescription>Por padrão, 100% vai para o primeiro vendedor. A soma deve ser 100%.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {div.map((d, i) => (
            <div key={d.vendedor} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{d.vendedor}</span>
              <Input type="number" className="w-24" min={0} max={100} value={d.percentual}
                onChange={e => setDiv(div.map((x, j) => j === i ? { ...x, percentual: Number(e.target.value) } : x))} />
              <span className="text-sm">%</span>
            </div>
          ))}
          <div className={`text-sm ${soma === 100 ? 'text-muted-foreground' : 'text-destructive'}`}>Total: {soma}%</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onSave(null)}>Voltar ao padrão</Button>
          <Button disabled={soma !== 100} onClick={() => onSave(div.filter(d => d.percentual > 0))}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
