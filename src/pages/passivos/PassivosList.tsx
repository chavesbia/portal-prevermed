import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, ExternalLink, Search, CircleDollarSign, FileCheck2, ClipboardCheck, Link2, Pencil as PencilIcon, Check, X, Upload } from 'lucide-react';
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

function FlagCell({
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-md border transition-colors ${checked ? activeClass : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}{checked ? ' (marcado)' : ''}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function InlineLink({ value, onSave, disabled }: { value: string | null; onSave: (v: string | null) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        {value ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs truncate max-w-[140px]">
            <Link2 className="h-3 w-3 shrink-0" />
            <span className="truncate">2ª via</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {!disabled && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setDraft(value ?? ''); setEditing(true); }}>
            <PencilIcon className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input className="h-7 text-xs" value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://..." autoFocus />
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { onSave(draft.trim() || null); setEditing(false); }}>
        <Check className="h-3 w-3 text-emerald-600" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(false)}>
        <X className="h-3 w-3" />
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

  const handleDelete = async (r: Passivo) => {
    if (!confirm(`Excluir parcelamento ${r.numero_acordo}?`)) return;
    try {
      await del.mutateAsync(r.id);
      toast({ title: 'Parcelamento excluído' });
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
                <TableHead className="text-center">Controle operacional</TableHead>
                <TableHead>2ª via</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Atraso</TableHead>
                <TableHead>Última atualização</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-6">Nenhum parcelamento encontrado.</TableCell></TableRow>
              )}
              {filtered.map(r => {
                const risk = r.status === 'encerrado' ? 'ok' : getRiskLevel(r.parcelas_em_atraso);
                return (
                <TableRow key={r.id} className={RISK_ROW_CLASS[risk]}>
                  <TableCell className="font-mono text-xs">{formatCnpj(r.cnpj)}</TableCell>
                  <TableCell className="font-medium">{r.empresa_nome}</TableCell>
                  <TableCell>
                    {r.link_acesso ? (
                      <a href={r.link_acesso} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        {r.numero_acordo} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : r.numero_acordo}
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.tipo_parcelamento}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.parcelas_pagas}/{r.parcelas_totais}
                    <div className="text-xs text-muted-foreground">restam {r.parcelas_restantes}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.valor_mensal)}</TableCell>
                  <TableCell className="text-center">{r.dia_vencimento ? `Dia ${r.dia_vencimento}` : '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5">
                      <FlagCell
                        label="Guia recebida"
                        Icon={FileCheck2}
                        checked={r.guia_recebida}
                        disabled={!canEdit}
                        activeClass="bg-blue-100 text-blue-700 border-blue-300"
                        onChange={(v) => patch(r, { guia_recebida: v })}
                      />
                      <FlagCell
                        label="Guia conferida"
                        Icon={ClipboardCheck}
                        checked={r.guia_conferida}
                        disabled={!canEdit || !r.guia_recebida}
                        activeClass="bg-violet-100 text-violet-700 border-violet-300"
                        onChange={(v) => patch(r, { guia_conferida: v })}
                      />
                      <FlagCell
                        label="Pagamento baixado (incrementa parcela)"
                        Icon={CircleDollarSign}
                        checked={r.pagamento_baixado}
                        disabled={!canEdit || !r.guia_conferida}
                        activeClass="bg-emerald-100 text-emerald-700 border-emerald-300"
                        onChange={(v) => patch(r, { pagamento_baixado: v }, v ? 'Pagamento baixado e parcela contabilizada' : undefined)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <InlineLink
                      value={r.link_segunda_via}
                      disabled={!canEdit}
                      onSave={(v) => patch(r, { link_segunda_via: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${r.parcelas_em_atraso > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{r.parcelas_em_atraso}</span>
                      {r.status !== 'encerrado' && risk !== 'ok' && (
                        <span className={`inline-flex items-center px-1.5 py-0 rounded border text-[10px] font-medium ${RISK_BADGE[risk]}`}>
                          {RISK_LABEL[risk]}
                          {risk === 'critico' && ' · risco cancel.'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDateTime(r.last_updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(r)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PassivoFormDialog open={open} onOpenChange={setOpen} initial={editing} />
    </div>
  );
}
