import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, Pencil, Trash2, XCircle, Archive, Search, Send, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCNPJ, formatBRL, formatDateBR } from '@/lib/contractual/format';
import { STATUS_LABEL, getContractStatusDisplay } from '@/lib/contractual/statusLabels';
import { Input } from '@/components/ui/input';
import { ContratualContratoWizard } from './ContratualContratoWizard';
import { ContratualContratoDetalhe } from './ContratualContratoDetalhe';
import { ContratualRescisaoDialog } from './ContratualRescisaoDialog';
import { ContratualLegadoDialog } from './ContratualLegadoDialog';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Props { canEdit: boolean }

const PAGE_SIZE = 25;
const PENDENTES = ['aguardando_assinatura', 'parcialmente_assinado'];

const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function diasAte(d?: string | null) {
  if (!d) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + 'T00:00:00').getTime() - hoje.getTime()) / 86400000);
}

export default function ContratualContratos({ canEdit }: Props) {
  const { isAdmMaster } = useAuth() as any;
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') || '';
  const st = sp.get('st') || 'todos';
  const vig = sp.get('vig') || 'todas';
  const vmin = sp.get('vmin') || '';
  const vmax = sp.get('vmax') || '';
  const page = Math.max(1, Number(sp.get('pg') || 1));

  const [searchInput, setSearchInput] = useState(q);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(sp.get('contrato'));
  const [rescisaoOpen, setRescisaoOpen] = useState(false);
  const [legadoOpen, setLegadoOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const setParam = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v && v !== 'todos' && v !== 'todas' ? next.set(k, v) : next.delete(k)));
    if (resetPage) next.delete('pg');
    setSp(next, { replace: true });
  };

  // Busca com pequena espera: não recarrega a cada tecla
  useEffect(() => {
    const t = setTimeout(() => { if (searchInput !== q) setParam({ q: searchInput }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Carrega a lista uma vez (sem o texto completo do contrato, que é pesado)
  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contract-contratos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contract_contratos')
        .select('id, numero_contrato, status, data_inicio, data_fim, valor_mensal, pdf_url, tem_html_final, origem, numero_original, cliente:contract_clientes(razao_social, cnpj, company:companies(razao_social, cnpj))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        html_final: c.tem_html_final ? '1' : null,
        _razao: c.cliente?.company?.razao_social || c.cliente?.razao_social || '',
        _fantasia: "",
        _cnpj: (c.cliente?.company?.cnpj || c.cliente?.cnpj || '').replace(/\D/g, ''),
      }));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('contract-contratos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_contratos' },
        () => qc.invalidateQueries({ queryKey: ['contract-contratos'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const filtrados = useMemo(() => {
    const termos = norm(q).split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, '');
    const min = vmin ? Number(vmin) : null;
    const max = vmax ? Number(vmax) : null;
    return contratos.filter((c: any) => {
      if (termos.length) {
        const alvo = norm(`${c.numero_contrato || ''} ${c.numero_original || ''} ${c._razao} ${c._fantasia}`);
        const okTexto = termos.every(t => alvo.includes(t));
        const okCnpj = digits.length >= 3 && c._cnpj.includes(digits);
        if (!okTexto && !okCnpj) return false;
      }
      if (st !== 'todos') {
        if (st === 'pendentes') { if (!PENDENTES.includes(c.status)) return false; }
        else if (st === 'em_preenchimento') { if (!(c.status === 'rascunho' && !c.html_final)) return false; }
        else if (st === 'rascunho') { if (!(c.status === 'rascunho' && c.html_final)) return false; }
        else if (c.status !== st) return false;
      }
      if (vig !== 'todas') {
        const d = diasAte(c.data_fim);
        if (vig === 'sem_data') { if (d !== null) return false; }
        else if (d === null) return false;
        else if (vig === 'vencidos' && d >= 0) return false;
        else if (vig.startsWith('ate') && (d < 0 || d > Number(vig.slice(3)))) return false;
        else if (vig === 'mais90' && d <= 90) return false;
      }
      const v = Number(c.valor_mensal || 0);
      if (min !== null && v < min) return false;
      if (max !== null && v > max) return false;
      return true;
    });
  }, [contratos, q, st, vig, vmin, vmax]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagina = filtrados.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const temFiltro = q || st !== 'todos' || vig !== 'todas' || vmin || vmax;
  const pendentesFiltrados = filtrados.filter((c: any) => PENDENTES.includes(c.status));

  const isRascunhoAberto = (c: any) => c.status === 'rascunho' && !c.html_final;
  const abrirContrato = (c: any) => {
    if (isRascunhoAberto(c)) { setDraftId(c.id); setWizardOpen(true); }
    else setDetailId(c.id);
  };

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const reenviarSelecionados = async (ids: string[]) => {
    if (!ids.length) return;
    setSending(true);
    let ok = 0; const falhas: string[] = [];
    for (const id of ids) {
      const { data, error } = await supabase.functions.invoke('autentique-resend', { body: { contrato_id: id } });
      const c = contratos.find((x: any) => x.id === id);
      if (error || (data as any)?.error) falhas.push(c?.numero_contrato || id); else ok++;
    }
    setSending(false);
    setSelected(new Set());
    if (ok) toast.success(`Lembrete de assinatura reenviado em ${ok} contrato(s)`);
    if (falhas.length) toast.error(`Não foi possível reenviar: ${falhas.join(', ')}`);
  };

  const excluirContrato = async (id: string, pdfUrl?: string) => {
    setDeleting(true);
    try {
      if (pdfUrl) await supabase.storage.from('contract-pdfs').remove([pdfUrl]).catch(() => {});
      await supabase.from('contract_assinaturas').delete().eq('contrato_id', id);
      await supabase.from('contract_eventos').delete().eq('contrato_id', id);
      const { error } = await supabase.from('contract_contratos').delete().eq('id', id);
      if (error) throw error;
      toast.success('Contrato excluído');
      qc.invalidateQueries({ queryKey: ['contract-contratos'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir contrato');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input placeholder="Buscar por empresa, nº do contrato ou CNPJ…" className="pl-8 pr-8"
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setParam({ q: searchInput }); }} />
          {searchInput && (
            <button className="absolute right-2 top-2.5 text-muted-foreground" onClick={() => { setSearchInput(''); setParam({ q: '' }); }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => setRescisaoOpen(true)} className="gap-1.5 text-destructive">
              <XCircle className="h-4 w-4" /> Registrar Rescisão
            </Button>
            <Button variant="outline" onClick={() => setLegadoOpen(true)} className="gap-1.5">
              <Archive className="h-4 w-4" /> Cadastrar Contrato Legado
            </Button>
            <Button onClick={() => { setDraftId(null); setWizardOpen(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Contrato
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select value={st} onValueChange={v => setParam({ st: v })}>
            <SelectTrigger className="w-[210px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendentes">Pendentes de assinatura</SelectItem>
              <SelectItem value="em_preenchimento">Em preenchimento</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Vigência (fim)</span>
          <Select value={vig} onValueChange={v => setParam({ vig: v })}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="vencidos">Vencidos</SelectItem>
              <SelectItem value="ate30">Vence em até 30 dias</SelectItem>
              <SelectItem value="ate60">Vence em até 60 dias</SelectItem>
              <SelectItem value="ate90">Vence em até 90 dias</SelectItem>
              <SelectItem value="mais90">Mais de 90 dias</SelectItem>
              <SelectItem value="sem_data">Sem data de fim</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Valor mensal (R$)</span>
          <div className="flex items-center gap-1">
            <Input type="number" placeholder="De" className="w-24 h-9" defaultValue={vmin}
              onBlur={e => setParam({ vmin: e.target.value })} onKeyDown={e => e.key === 'Enter' && setParam({ vmin: (e.target as HTMLInputElement).value })} />
            <Input type="number" placeholder="Até" className="w-24 h-9" defaultValue={vmax}
              onBlur={e => setParam({ vmax: e.target.value })} onKeyDown={e => e.key === 'Enter' && setParam({ vmax: (e.target as HTMLInputElement).value })} />
          </div>
        </div>
        {temFiltro && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearchInput(''); setSp(new URLSearchParams({ tab: 'contratos' }), { replace: true }); }}>
            Limpar filtros
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">{filtrados.length} contrato(s)</span>
      </div>

      {canEdit && (selected.size > 0 || (st === 'pendentes' && pendentesFiltrados.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <Send className="h-4 w-4 text-primary" />
          {selected.size > 0
            ? <span>{selected.size} contrato(s) selecionado(s)</span>
            : <span>{pendentesFiltrados.length} contrato(s) aguardando assinatura neste filtro</span>}
          <div className="ml-auto flex gap-2">
            {selected.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={sending} className="gap-1.5">
                  <Send className="h-4 w-4" /> {sending ? 'Reenviando…' : 'Reenviar para assinatura'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reenviar lembrete de assinatura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os assinantes que ainda não assinaram receberão novamente o e-mail do Autentique em{' '}
                    {selected.size || pendentesFiltrados.length} contrato(s).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => reenviarSelecionados(selected.size ? [...selected] : pendentesFiltrados.map((c: any) => c.id))}>
                    Reenviar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {canEdit && <TableHead className="w-8"></TableHead>}
                  <TableHead>Nº</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!isLoading && filtrados.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nenhum contrato encontrado.</TableCell></TableRow>
                )}
                {pagina.map((c: any) => {
                  const stD = getContractStatusDisplay(c);
                  const d = diasAte(c.data_fim);
                  const podeSel = PENDENTES.includes(c.status);
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => abrirContrato(c)}>
                      {canEdit && (
                        <TableCell onClick={e => e.stopPropagation()}>
                          {podeSel && <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs whitespace-nowrap">{c.numero_contrato}</TableCell>
                      <TableCell>
                        <div className="font-medium">{c._razao}</div>
                        {c._fantasia && c._fantasia !== c._razao && <div className="text-[11px] text-muted-foreground">{c._fantasia}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{formatCNPJ(c._cnpj)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className={`${stD.tone} whitespace-nowrap`}>{stD.label}</Badge>
                          {c.origem === 'legado' && (
                            <Badge variant="secondary" className="whitespace-nowrap gap-1"><Archive className="h-3 w-3" /> Legado</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDateBR(c.data_inicio)} → {formatDateBR(c.data_fim)}
                        {d !== null && d < 0 && <div className="text-destructive">vencido há {-d} dia(s)</div>}
                        {d !== null && d >= 0 && d <= 60 && <div className="text-muted-foreground">vence em {d} dia(s)</div>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatBRL(c.valor_mensal)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); abrirContrato(c); }}>
                            {isRascunhoAberto(c) ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          {isAdmMaster && ['rascunho', 'cancelado'].includes(c.status) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => e.stopPropagation()} disabled={deleting}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir contrato {c.numero_contrato}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação remove o contrato, seus assinantes, eventos e o PDF. Não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => excluirContrato(c.id, c.pdf_url)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filtrados.length > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-sm">
              <span className="text-muted-foreground">Página {pageSafe} de {totalPages}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={pageSafe <= 1}
                onClick={() => setParam({ pg: String(pageSafe - 1) }, false)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={pageSafe >= totalPages}
                onClick={() => setParam({ pg: String(pageSafe + 1) }, false)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ContratualContratoWizard
        key={draftId || 'novo'}
        open={wizardOpen}
        draftId={draftId}
        onOpenChange={(b) => { setWizardOpen(b); if (!b) { setDraftId(null); qc.invalidateQueries({ queryKey: ['contract-contratos'] }); } }}
        onCreated={(id) => { qc.invalidateQueries({ queryKey: ['contract-contratos'] }); setWizardOpen(false); setDraftId(null); setDetailId(id); }}
      />

      <ContratualContratoDetalhe
        contratoId={detailId}
        onClose={() => { setDetailId(null); if (sp.get('contrato')) setParam({ contrato: '' }, false); qc.invalidateQueries({ queryKey: ['contract-contratos'] }); }}
        canEdit={canEdit}
        onCorrectionRequested={(newId) => { setDetailId(null); setDraftId(newId); setWizardOpen(true); }}
      />

      <ContratualRescisaoDialog open={rescisaoOpen} onOpenChange={setRescisaoOpen}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['contract-contratos'] })} />
      <ContratualLegadoDialog open={legadoOpen} onOpenChange={setLegadoOpen}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['contract-contratos'] })} />
    </div>
  );
}
