import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus, Pencil, Trash2, ExternalLink, Search, CircleDollarSign, FileCheck2,
  ClipboardCheck, Link2, Pencil as PencilIcon, Check, X, Upload, ChevronRight,
} from 'lucide-react';
import { usePassivos, useDeletePassivo, useUpdatePassivoFields, type Passivo } from '@/hooks/usePassivos';
import { brl, formatCnpj, STATUS_BADGE, STATUS_LABELS, getRiskLevel, RISK_ROW_CLASS, RISK_BADGE, RISK_LABEL } from '@/lib/passivos/utils';
import { PassivoFormDialog } from '@/components/passivos/PassivoFormDialog';
import PassivosImportDialog from '@/components/passivos/PassivosImportDialog';
import { useToast } from '@/hooks/use-toast';

interface Props {
  canEdit: boolean;
  canDelete: boolean;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function FlagButton({
  checked, onChange, disabled, label, Icon, activeClass,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  Icon: typeof CircleDollarSign;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors w-full ${checked ? activeClass : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {checked && <Check className="h-4 w-4" />}
    </button>
  );
}

function InlineLink({ value, onSave, disabled }: { value: string | null; onSave: (v: string | null) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        {value ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm truncate">
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[280px]">{value}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">Sem link</span>
        )}
        {!disabled && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setDraft(value ?? ''); setEditing(true); }}>
            <PencilIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input className="h-8 text-sm" value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://..." autoFocus />
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { onSave(draft.trim() || null); setEditing(false); }}>
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function PassivosList({ canEdit, canDelete }: Props) {
  const { data: rows = [], isLoading } = usePassivos();
  const del = useDeletePassivo();
  const update = useUpdatePassivoFields();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Passivo | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.empresa_nome.toLowerCase().includes(q)
      || r.cnpj.includes(q.replace(/\D/g, ''))
      || r.numero_acordo.toLowerCase().includes(q)
      || r.tipo_parcelamento.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId]);

  const handleDelete = async (r: Passivo) => {
    if (!confirm(`Excluir parcelamento ${r.numero_acordo}?`)) return;
    try {
      await del.mutateAsync(r.id);
      toast({ title: 'Parcelamento excluído' });
      setSelectedId(null);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const patch = async (r: Passivo, p: Partial<Passivo>, successMsg?: string) => {
    try {
      await update.mutateAsync({ id: r.id, patch: p });
      if (successMsg) toast({ title: successMsg });
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por CNPJ, empresa, acordo ou tipo…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canEdit && (
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
              <Upload className="h-4 w-4" /> Importar planilha
            </Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo parcelamento
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CNPJ</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Acordo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Parcelas</TableHead>
                <TableHead className="text-right">Valor mensal</TableHead>
                <TableHead className="text-center">Venc.</TableHead>
                <TableHead className="text-center">Controle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Atraso</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Nenhum parcelamento encontrado.</TableCell></TableRow>
              )}
              {filtered.map(r => {
                const risk = r.status === 'encerrado' ? 'ok' : getRiskLevel(r.parcelas_em_atraso);
                return (
                <TableRow
                  key={r.id}
                  className={`${RISK_ROW_CLASS[risk]} cursor-pointer`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <TableCell className="font-mono text-xs whitespace-nowrap">{formatCnpj(r.cnpj)}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{r.empresa_nome}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.numero_acordo}</TableCell>
                  <TableCell><Badge variant="outline">{r.tipo_parcelamento}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    {r.parcelas_pagas}/{r.parcelas_totais}
                    <span className="text-xs text-muted-foreground"> · resta {r.parcelas_restantes}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{brl(r.valor_mensal)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap">{r.dia_vencimento ? `Dia ${r.dia_vencimento}` : '—'}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex items-center justify-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${r.guia_recebida ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                              <FileCheck2 className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Guia recebida{r.guia_recebida ? ' ✓' : ''}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${r.guia_conferida ? 'bg-violet-100 text-violet-700' : 'bg-muted text-muted-foreground'}`}>
                              <ClipboardCheck className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Guia conferida{r.guia_conferida ? ' ✓' : ''}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${r.pagamento_baixado ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                              <CircleDollarSign className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Pagamento baixado{r.pagamento_baixado ? ' ✓' : ''}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right whitespace-nowrap ${r.parcelas_em_atraso > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                    {r.parcelas_em_atraso}
                    {r.status !== 'encerrado' && risk !== 'ok' && (
                      <span className={`ml-1.5 inline-flex items-center px-1.5 py-0 rounded border text-[10px] font-medium ${RISK_BADGE[risk]}`}>
                        {RISK_LABEL[risk]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Side sheet — operational control */}
      <Sheet open={!!selectedId} onOpenChange={(v) => !v && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (() => {
            const r = selected;
            const risk = r.status === 'encerrado' ? 'ok' : getRiskLevel(r.parcelas_em_atraso);
            return (
              <>
                <SheetHeader className="space-y-1">
                  <SheetTitle className="text-lg">{r.empresa_nome}</SheetTitle>
                  <SheetDescription className="font-mono text-xs">{formatCnpj(r.cnpj)}</SheetDescription>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline">{r.tipo_parcelamento}</Badge>
                    <span className="text-sm font-medium">Acordo {r.numero_acordo}</span>
                    {r.link_acesso && (
                      <a href={r.link_acesso} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                        <ExternalLink className="h-3 w-3" /> Portal
                      </a>
                    )}
                  </div>
                </SheetHeader>

                <div className="grid grid-cols-3 gap-2 mt-5">
                  <Stat label="Pagas" value={`${r.parcelas_pagas}/${r.parcelas_totais}`} />
                  <Stat label="Restantes" value={String(r.parcelas_restantes)} />
                  <Stat label="Valor mensal" value={brl(r.valor_mensal)} />
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${STATUS_BADGE[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  {risk !== 'ok' && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${RISK_BADGE[risk]}`}>
                      {RISK_LABEL[risk]} · {r.parcelas_em_atraso} em atraso
                    </span>
                  )}
                  {r.dia_vencimento && <span className="text-xs text-muted-foreground">Vencimento dia {r.dia_vencimento}</span>}
                </div>

                <div className="mt-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Controle operacional</h4>
                  <div className="space-y-2">
                    <FlagButton
                      label="Guia recebida"
                      Icon={FileCheck2}
                      checked={r.guia_recebida}
                      disabled={!canEdit}
                      activeClass="bg-blue-100 text-blue-800 border-blue-300"
                      onChange={(v) => patch(r, { guia_recebida: v })}
                    />
                    <FlagButton
                      label="Guia conferida"
                      Icon={ClipboardCheck}
                      checked={r.guia_conferida}
                      disabled={!canEdit || !r.guia_recebida}
                      activeClass="bg-violet-100 text-violet-800 border-violet-300"
                      onChange={(v) => patch(r, { guia_conferida: v })}
                    />
                    <FlagButton
                      label="Pagamento baixado (incrementa parcela)"
                      Icon={CircleDollarSign}
                      checked={r.pagamento_baixado}
                      disabled={!canEdit || !r.guia_conferida}
                      activeClass="bg-emerald-100 text-emerald-800 border-emerald-300"
                      onChange={(v) => patch(r, { pagamento_baixado: v }, v ? 'Pagamento baixado e parcela contabilizada' : undefined)}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Link 2ª via</h4>
                  <InlineLink
                    value={r.link_segunda_via}
                    disabled={!canEdit}
                    onSave={(v) => patch(r, { link_segunda_via: v })}
                  />
                </div>

                {r.observacoes && (
                  <div className="mt-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Observações</h4>
                    <p className="text-sm whitespace-pre-wrap">{r.observacoes}</p>
                  </div>
                )}

                <div className="mt-6 text-xs text-muted-foreground">
                  Última atualização: {fmtDateTime(r.last_updated_at)}
                </div>

                <div className="mt-6 flex items-center gap-2 border-t pt-4">
                  {canEdit && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="h-4 w-4" /> Editar dados
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => handleDelete(r)}>
                      <Trash2 className="h-4 w-4" /> Excluir
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <PassivoFormDialog open={open} onOpenChange={setOpen} initial={editing} />
      <PassivosImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
