import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Star } from 'lucide-react';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { useCommercialContracts, type CommercialContract, type ModeloContratual } from '@/hooks/useCommercialContracts';

interface Props {
  clientId: string;
  readOnly: boolean;
}

const MODELOS: ModeloContratual[] = ['Gestão Ocupacional', 'Parceira', 'Por Uso'];

function fmt(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; }
}

function derivedStatus(c: CommercialContract) {
  if (c.status_derivado === 'Cancelado' || c.status_derivado === 'Renovado') return c.status_derivado;
  if (c.end_date) {
    const end = parseISO(c.end_date);
    if (isBefore(end, new Date())) return 'Vencido';
    if (isBefore(end, addDays(new Date(), 60))) return 'A Vencer';
  }
  if (!c.signed) return 'Aguardando assinatura';
  return 'Vigente';
}

const statusBadge: Record<string, string> = {
  'Vigente': 'bg-emerald-600 text-white',
  'A Vencer': 'bg-yellow-500 text-white',
  'Vencido': 'bg-destructive text-destructive-foreground',
  'Aguardando assinatura': 'bg-orange-500 text-white',
  'Renovado': 'bg-slate-500 text-white',
  'Cancelado': 'bg-zinc-700 text-white',
};

export default function ContractsHistory({ clientId, readOnly }: Props) {
  const { contracts, isLoading, createContract, updateContract, deleteContract, setCurrent, renewCurrent } = useCommercialContracts(clientId);
  const [openNew, setOpenNew] = useState(false);
  const [openRenew, setOpenRenew] = useState(false);
  const [renewEnd, setRenewEnd] = useState('');
  const [editing, setEditing] = useState<CommercialContract | null>(null);

  const current = contracts.find(c => c.is_current);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold">Histórico de Contratos</h3>
            <p className="text-xs text-muted-foreground">{contracts.length} contrato(s) registrado(s)</p>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              {current && (
                <Dialog open={openRenew} onOpenChange={setOpenRenew}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <RefreshCw className="h-4 w-4" /> Renovar Vigente
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Renovar contrato vigente</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Será criado um novo contrato com início em <strong>{fmt(current.end_date) || 'hoje'}</strong>,
                        clonando modelo, renovação automática e demais flags. O contrato atual passa a "Renovado".
                      </p>
                      <div>
                        <Label>Nova data de vencimento</Label>
                        <Input type="date" value={renewEnd} onChange={e => setRenewEnd(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setOpenRenew(false)}>Cancelar</Button>
                      <Button
                        disabled={!renewEnd}
                        onClick={async () => { await renewCurrent.mutateAsync(renewEnd); setOpenRenew(false); setRenewEnd(''); }}
                      >Renovar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              <Dialog open={openNew} onOpenChange={setOpenNew}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo Contrato</Button>
                </DialogTrigger>
                <ContractFormDialog
                  onClose={() => setOpenNew(false)}
                  onSubmit={async (payload) => { await createContract.mutateAsync(payload); setOpenNew(false); }}
                />
              </Dialog>
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">Nenhum contrato registrado para este cliente.</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Vigente</th>
                  <th className="px-3 py-2 text-left">Nº Contrato</th>
                  <th className="px-3 py-2 text-left">Ano</th>
                  <th className="px-3 py-2 text-left">Modelo</th>
                  <th className="px-3 py-2 text-left">Início</th>
                  <th className="px-3 py-2 text-left">Vencimento</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Assinado</th>
                  <th className="px-3 py-2 text-left">Renov. Auto.</th>
                  <th className="px-3 py-2 text-left">Tab. Exames</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => {
                  const st = derivedStatus(c);
                  return (
                    <tr key={c.id} className={`border-t ${c.is_current ? 'bg-emerald-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        {c.is_current ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" /> : (
                          !readOnly && <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setCurrent.mutate(c.id)}>Marcar</Button>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{c.contract_number || '—'}</td>
                      <td className="px-3 py-2">{c.contract_year || '—'}</td>
                      <td className="px-3 py-2">{c.modelo_contratual || <span className="text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />—</span>}</td>
                      <td className="px-3 py-2">{fmt(c.start_date)}</td>
                      <td className="px-3 py-2">{fmt(c.end_date)}</td>
                      <td className="px-3 py-2"><Badge className={`${statusBadge[st] || 'bg-muted'} text-xs`}>{st}</Badge></td>
                      <td className="px-3 py-2">{c.signed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : '—'}</td>
                      <td className="px-3 py-2">{c.auto_renewal ? `Sim${c.renewal_term_months ? ` (${c.renewal_term_months}m)` : ''}` : 'Não'}</td>
                      <td className="px-3 py-2">{c.has_exam_table ? 'Sim' : 'Não'}</td>
                      <td className="px-3 py-2 text-right">
                        {!readOnly && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(c)}>Editar</Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteContract.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {editing && (
          <Dialog open onOpenChange={() => setEditing(null)}>
            <ContractFormDialog
              initial={editing}
              onClose={() => setEditing(null)}
              onSubmit={async (payload) => { await updateContract.mutateAsync({ id: editing.id, ...payload }); setEditing(null); }}
            />
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

function ContractFormDialog({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: CommercialContract;
  onClose: () => void;
  onSubmit: (payload: Partial<CommercialContract>) => Promise<void> | void;
}) {
  const [form, setForm] = useState<Partial<CommercialContract>>(
    initial || {
      contract_number: '',
      proposal_number: '',
      modelo_contratual: null,
      contract_year: new Date().getFullYear(),
      start_date: null,
      end_date: null,
      signed: false,
      auto_renewal: false,
      renewal_term_months: 12,
      has_exam_table: false,
      has_service_table: false,
      is_current: false,
      notes: '',
    }
  );

  const set = <K extends keyof CommercialContract>(k: K, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{initial ? 'Editar contrato' : 'Novo contrato'}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nº Contrato</Label><Input value={form.contract_number || ''} onChange={e => set('contract_number', e.target.value)} /></div>
        <div><Label>Nº Proposta</Label><Input value={form.proposal_number || ''} onChange={e => set('proposal_number', e.target.value)} /></div>
        <div>
          <Label>Modelo Contratual</Label>
          <Select value={form.modelo_contratual || ''} onValueChange={v => set('modelo_contratual', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{MODELOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Ano do Contrato</Label><Input type="number" value={form.contract_year || ''} onChange={e => set('contract_year', Number(e.target.value) || null)} /></div>
        <div><Label>Início Vigência</Label><Input type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value || null)} /></div>
        <div><Label>Vencimento</Label><Input type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value || null)} /></div>
        <div><Label>Situação Prospecção</Label><Input value={form.prospect_status || ''} onChange={e => set('prospect_status', e.target.value)} /></div>
        <div><Label>Prazo Renovação (meses)</Label><Input type="number" value={form.renewal_term_months || ''} onChange={e => set('renewal_term_months', Number(e.target.value) || null)} /></div>
        <div className="flex items-center justify-between border rounded px-3 py-2"><Label className="m-0">Assinado</Label><Switch checked={!!form.signed} onCheckedChange={v => set('signed', v)} /></div>
        <div className="flex items-center justify-between border rounded px-3 py-2"><Label className="m-0">Renovação Automática</Label><Switch checked={!!form.auto_renewal} onCheckedChange={v => set('auto_renewal', v)} /></div>
        <div className="flex items-center justify-between border rounded px-3 py-2"><Label className="m-0">Tabela de Exames</Label><Switch checked={!!form.has_exam_table} onCheckedChange={v => set('has_exam_table', v)} /></div>
        <div className="flex items-center justify-between border rounded px-3 py-2"><Label className="m-0">Tabela de Serviços</Label><Switch checked={!!form.has_service_table} onCheckedChange={v => set('has_service_table', v)} /></div>
        <div className="col-span-2 flex items-center justify-between border rounded px-3 py-2"><Label className="m-0">Marcar como Vigente</Label><Switch checked={!!form.is_current} onCheckedChange={v => set('is_current', v)} /></div>
        <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => onSubmit(form)}>{initial ? 'Salvar' : 'Criar'}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
