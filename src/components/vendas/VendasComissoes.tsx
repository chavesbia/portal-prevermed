import { Fragment, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Download, Split, CheckCircle2, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Venda, VendaItem, useInvalidateVendas, useTodosItens, useFechamentos } from '@/hooks/useVendas';
import { brl, comissaoPorVendedor, isComissionavel, Divisao } from '@/lib/vendas/skywork';
import { auditVendas, titleCase } from '@/lib/vendas/audit';
import { VendaVendedorBadge, TipoTag } from './VendasList';

const db = supabase as any;
const fmt = (d: string | null) => (d ? format(parseISO(d), 'dd/MM/yyyy') : '—');

export function VendasComissoes({ vendas, canEdit, canApprove }: { vendas: Venda[]; canEdit: boolean; canApprove: boolean }) {
  const { user } = useAuth();
  const invalidate = useInvalidateVendas();
  const [params, setParams] = useSearchParams();
  const [dividir, setDividir] = useState<Venda | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [verSemVend, setVerSemVend] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { data: itensMap } = useTodosItens();
  const { data: fech } = useFechamentos();

  const de = params.get('cde') || '';
  const ate = params.get('cate') || '';
  const vend = params.get('cvend') || 'all';
  const status = params.get('cstatus') || 'abertas';
  const setP = (k: string, v: string) => { const p = new URLSearchParams(params); if (!v || v === 'all') p.delete(k); else p.set(k, v); setParams(p, { replace: true }); };

  const itensDe = (id: string) => itensMap?.get(id) || [];
  const fechadaPara = (vid: string, vendedor: string) => fech?.fechados.has(`${vid}|${vendedor}`);
  const vendaFechada = (vid: string) => !!fech?.vendasFechadas.has(vid);

  const noPeriodo = useMemo(() => vendas.filter(v => {
    if (de && (!v.data_venda || v.data_venda < de)) return false;
    if (ate && (!v.data_venda || v.data_venda > ate)) return false;
    return true;
  }), [vendas, de, ate]);

  const semVendedor = useMemo(() => noPeriodo.filter(v => v.situacao === 'Concluído' && !v.vendedor), [noPeriodo]);
  const elegiveis = useMemo(() => noPeriodo.filter(isComissionavel), [noPeriodo]);
  const vendedoresOpc = useMemo(() => Array.from(new Set(elegiveis.flatMap(v => comissaoPorVendedor(v).map(c => c.vendedor)))).sort(), [elegiveis]);

  // Linhas (venda × vendedor) considerando divisão
  const linhas = useMemo(() => elegiveis.flatMap(v => comissaoPorVendedor(v, itensDe(v.id)).map(c => ({ v, c, fechada: !!fechadaPara(v.id, c.vendedor) })))
    .filter(l => vend === 'all' || l.c.vendedor === vend)
    .filter(l => status === 'todas' || (status === 'fechadas' ? l.fechada : !l.fechada)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [elegiveis, itensMap, fech, vend, status]);

  const porVendedor = useMemo(() => {
    const m = new Map<string, { base: number; comissao: number; pend: number; qtd: number }>();
    linhas.forEach(({ v, c }) => {
      const r = m.get(c.vendedor) || { base: 0, comissao: 0, pend: 0, qtd: 0 };
      r.base += c.base; r.comissao += c.comissao; r.qtd += 1; if (!v.validado) r.pend += 1;
      m.set(c.vendedor, r);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].comissao - a[1].comissao);
  }, [linhas]);

  const vendasUnicas = useMemo(() => Array.from(new Map(linhas.map(l => [l.v.id, l.v])).values()), [linhas]);

  const atualizar = async (v: Venda, patch: Record<string, unknown>, acao: string) => {
    const { error } = await db.from('vendas').update(patch).eq('id', v.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await auditVendas(user?.id, acao, v.id, { numero_venda: v.numero_venda, ...patch });
    invalidate();
  };

  const qc = useQueryClient();
  const setTipoItem = async (v: Venda, it: VendaItem, tipo: string) => {
    // Atualização imediata na tela; grava no banco em segundo plano
    const patch = (t: string) => qc.setQueryData(['venda-itens', 'todos'], (old: Map<string, VendaItem[]> | undefined) => {
      if (!old) return old;
      const m = new Map(old);
      m.set(it.venda_id, (m.get(it.venda_id) || []).map(x => x.id === it.id ? { ...x, tipo_comissao: t } : x));
      return m;
    });
    const anterior = it.tipo_comissao;
    patch(tipo);
    const { error } = await db.from('venda_itens').update({ tipo_comissao: tipo }).eq('id', it.id);
    if (error) { patch(anterior); toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    auditVendas(user?.id, 'tipo_comissao_servico', v.id, { numero_venda: v.numero_venda, servico: it.nome, tipo });
  };

  const validarTodas = async () => {
    const ids = vendasUnicas.filter(v => !v.validado && !vendaFechada(v.id)).map(v => v.id);
    if (!ids.length) return;
    const { error } = await db.from('vendas').update({ validado: true }).in('id', ids);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await auditVendas(user?.id, 'validar_comissoes_lote', null, { quantidade: ids.length });
    toast({ title: 'Comissões validadas', description: `${ids.length} vendas.` });
    invalidate();
  };

  // Fechamento: exige período + vendedor, somente linhas abertas
  const abertasFechamento = vend !== 'all' ? linhas.filter(l => !l.fechada) : [];
  const naoValidadas = abertasFechamento.filter(l => !l.v.validado).length;
  const podeFechar = canApprove && !!de && !!ate && vend !== 'all' && status !== 'fechadas' && abertasFechamento.length > 0;

  const fechar = async () => {
    setSalvando(true);
    try {
      const base = abertasFechamento.reduce((s, l) => s + l.c.base, 0);
      const com = abertasFechamento.reduce((s, l) => s + l.c.comissao, 0);
      const { data: f, error } = await db.from('vendas_fechamentos').insert({
        vendedor: vend, periodo_ini: de, periodo_fim: ate, total_base: base, total_comissao: com, qtd_vendas: abertasFechamento.length, created_by: user?.id,
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await db.from('vendas_fechamento_itens').insert(abertasFechamento.map(l => ({
        fechamento_id: f.id, venda_id: l.v.id, vendedor: l.c.vendedor, base: l.c.base, comissao: l.c.comissao,
      })));
      if (e2) { await db.from('vendas_fechamentos').delete().eq('id', f.id); throw new Error(e2.code === '23505' ? 'Alguma venda já foi fechada para este vendedor. Atualize a página.' : e2.message); }
      await auditVendas(user?.id, 'fechamento_comissao', f.id, { vendedor: vend, de, ate, qtd: abertasFechamento.length, total_comissao: com });
      toast({ title: 'Comissão fechada', description: `${vend}: ${brl(com)}` });
      setConfirmar(false);
      invalidate();
    } catch (e: any) {
      toast({ title: 'Erro no fechamento', description: e.message, variant: 'destructive' });
    } finally { setSalvando(false); }
  };

  const exportar = () => {
    const out = [['Vendedor', 'Nº Venda', 'Data', 'Cliente', 'CNPJ Cliente', 'Emitente', 'Fatura', 'NFS-e', 'Valor venda', '% divisão', 'Base', 'Taxa efetiva', 'Comissão', 'Validado', 'Fechada']];
    linhas.forEach(({ v, c, fechada }) => out.push([
      c.vendedor, v.numero_venda, fmt(v.data_venda), v.cliente_nome || '', v.cliente_cnpj || '', v.emitente_cnpj, v.fatura || '', v.nfse || '',
      v.valor.toFixed(2).replace('.', ','), String(c.percentual), c.base.toFixed(2).replace('.', ','), `${(c.taxa * 100).toFixed(2).replace('.', ',')}%`,
      c.comissao.toFixed(2).replace('.', ','), v.validado ? 'Sim' : 'Não', fechada ? 'Sim' : 'Não',
    ]));
    const csv = '\uFEFF' + out.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `comissoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {semVendedor.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span><strong>{semVendedor.length}</strong> vendas concluídas estão sem vendedor e não entram na comissão. Corrija no Skywork e importe novamente.</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setVerSemVend(!verSemVend)}>{verSemVend ? 'Ocultar' : 'Ver lista'}</Button>
          </div>
          {verSemVend && (
            <div className="rounded border bg-background overflow-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted"><tr className="text-left">{['Nº Venda', 'Data', 'Cliente', 'Emitente', 'Fatura', 'NFS-e', 'Valor'].map(h => <th key={h} className="px-2 py-1 whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{semVendedor.map(v => (
                  <tr key={v.id} className="border-t">
                    <td className="px-2 py-1 font-medium">{v.numero_venda}</td><td className="px-2 py-1">{fmt(v.data_venda)}</td>
                    <td className="px-2 py-1">{titleCase(v.cliente_nome)}</td><td className="px-2 py-1 whitespace-nowrap">{v.emitente_cnpj}</td>
                    <td className="px-2 py-1">{v.fatura || '—'}</td><td className="px-2 py-1">{v.nfse || '—'}</td><td className="px-2 py-1 whitespace-nowrap">{brl(v.valor)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Período e vendedor do fechamento</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><div className="text-xs text-muted-foreground mb-1">De</div><Input type="date" value={de} onChange={e => setP('cde', e.target.value)} className="w-[160px]" /></div>
          <div><div className="text-xs text-muted-foreground mb-1">Até</div><Input type="date" value={ate} onChange={e => setP('cate', e.target.value)} className="w-[160px]" /></div>
          <div><div className="text-xs text-muted-foreground mb-1">Vendedor</div>
            <Select value={vend} onValueChange={v => setP('cvend', v)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{vendedoresOpc.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><div className="text-xs text-muted-foreground mb-1">Situação</div>
            <Select value={status} onValueChange={v => setP('cstatus', v === 'abertas' ? '' : v)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="abertas">Em aberto</SelectItem><SelectItem value="fechadas">Já fechadas</SelectItem><SelectItem value="todas">Todas</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportar}><Download className="h-4 w-4 mr-2" />Exportar</Button>
            {canApprove && <Button variant="outline" onClick={validarTodas}><CheckCircle2 className="h-4 w-4 mr-2" />Validar exibidas</Button>}
            {canApprove && <Button disabled={!podeFechar} onClick={() => setConfirmar(true)} title="Informe período e um vendedor"><Lock className="h-4 w-4 mr-2" />Fechar comissão</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {porVendedor.map(([nome, r]) => (
          <Card key={nome}>
            <CardContent className="pt-4 space-y-1 text-sm">
              <div className="font-semibold">{nome}</div>
              <div className="text-2xl font-bold">{brl(r.comissao)}</div>
              <div className="text-xs text-muted-foreground">{r.qtd} vendas · Vendido {brl(r.base)}</div>
              {r.pend > 0 ? <Badge variant="outline" className="whitespace-nowrap">{r.pend} a validar</Badge> : <Badge variant="secondary" className="whitespace-nowrap">Tudo validado</Badge>}
            </CardContent>
          </Card>
        ))}
        {porVendedor.length === 0 && <div className="text-muted-foreground text-sm">Nenhuma venda comissionável neste filtro.</div>}
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
            {linhas.map(({ v, c, fechada }) => {
              const itens = itensDe(v.id);
              const travada = vendaFechada(v.id);
              const bloqueado = travada || (v.validado && !canApprove);
              const nNovo = itens.filter(i => i.tipo_comissao === 'novo').length;
              const key = `${v.id}|${c.vendedor}`;
              return (
                <Fragment key={key}>
                  <tr className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => setAberta(aberta === key ? null : key)}>
                    <td className="px-3 py-2 sticky left-0 bg-background font-medium whitespace-nowrap">
                      {aberta === key ? <ChevronDown className="inline h-4 w-4 mr-1" /> : <ChevronRight className="inline h-4 w-4 mr-1" />}{v.numero_venda}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmt(v.data_venda)}</td>
                    <td className="px-3 py-2 min-w-[220px]">{titleCase(v.cliente_nome)}</td>
                    <td className="px-3 py-2">{c.vendedor}{c.percentual !== 100 && <span className="text-xs text-muted-foreground"> ({c.percentual}%)</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{brl(v.valor)}</td>
                    <td className="px-3 py-2">
                      {nNovo === 0 ? <TipoTag tipo="renovacao" /> : nNovo === itens.length ? <TipoTag tipo="novo" />
                        : <Badge className="whitespace-nowrap bg-success/20 text-foreground hover:bg-success/20">Misto {nNovo}/{itens.length} novo</Badge>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{brl(c.comissao)}</td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      {v.compartilhada || Array.isArray(v.divisao) ? (
                        <Button variant="ghost" size="sm" disabled={!canEdit || bloqueado} onClick={() => setDividir(v)}>
                          <Split className="h-4 w-4 mr-1" />{Array.isArray(v.divisao) ? 'Dividida' : 'Dividir?'}
                        </Button>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      {fechada ? <Badge variant="outline" className="whitespace-nowrap"><Lock className="h-3 w-3 mr-1" />Fechada</Badge>
                        : <Checkbox checked={v.validado} disabled={!canApprove || travada} onCheckedChange={ck => atualizar(v, { validado: !!ck }, ck ? 'validar_comissao' : 'desvalidar_comissao')} />}
                    </td>
                  </tr>
                  {aberta === key && (
                    <tr className="bg-muted/30"><td colSpan={9} className="px-6 py-3">
                      <table className="w-full text-sm border bg-background">
                        <thead><tr className="text-left bg-muted"><th className="px-2 py-1">Serviço</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1">Comissão do serviço</th></tr></thead>
                        <tbody>
                          {itens.map(it => (
                            <tr key={it.id} className="border-t">
                              <td className="px-2 py-1">{it.nome}</td>
                              <td className="px-2 py-1 text-right whitespace-nowrap">{brl(Number(it.valor_total || 0))}</td>
                              <td className="px-2 py-1">
                                <div className="inline-flex rounded-md border overflow-hidden">
                                  {(['renovacao', 'novo'] as const).map(t => (
                                    <button key={t} disabled={!canEdit || bloqueado}
                                      onClick={() => it.tipo_comissao !== t && setTipoItem(v, it, t)}
                                      className={`px-2 py-1 text-xs whitespace-nowrap disabled:cursor-not-allowed ${it.tipo_comissao === t ? (t === 'novo' ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground') : 'bg-background text-muted-foreground'}`}>
                                      {t === 'novo' ? 'Novo 3%' : 'Renovação 0,5%'}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {itens.length === 0 && <tr><td colSpan={3} className="p-2 text-muted-foreground">Sem serviços.</td></tr>}
                        </tbody>
                      </table>
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
            {linhas.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhuma venda.</td></tr>}
          </tbody>
        </table>
      </div>

      {(fech?.lista.length || 0) > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Fechamentos realizados</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1">Vendedor</th><th>Período</th><th>Vendas</th><th>Base</th><th>Comissão</th><th>Fechado em</th></tr></thead>
              <tbody>{fech!.lista.map(f => (
                <tr key={f.id} className="border-t">
                  <td className="py-1">{f.vendedor}</td><td>{fmt(f.periodo_ini)} a {fmt(f.periodo_fim)}</td><td>{f.qtd_vendas}</td>
                  <td>{brl(Number(f.total_base))}</td><td className="font-medium">{brl(Number(f.total_comissao))}</td><td>{format(new Date(f.created_at), 'dd/MM/yyyy HH:mm')}</td>
                </tr>))}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar comissão de {vend}</DialogTitle>
            <DialogDescription>Período {fmt(de)} a {fmt(ate)}. Após fechar, essas vendas não poderão ser alteradas nem fechadas novamente.</DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1">
            <div>{abertasFechamento.length} vendas · Base {brl(abertasFechamento.reduce((s, l) => s + l.c.base, 0))}</div>
            <div className="text-lg font-bold">Comissão: {brl(abertasFechamento.reduce((s, l) => s + l.c.comissao, 0))}</div>
            {naoValidadas > 0 && <div className="text-destructive">{naoValidadas} vendas ainda não validadas. Valide antes de fechar.</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)}>Cancelar</Button>
            <Button disabled={naoValidadas > 0 || salvando} onClick={fechar}>Confirmar fechamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
