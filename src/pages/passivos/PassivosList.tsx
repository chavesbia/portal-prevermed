import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ExternalLink, Search } from 'lucide-react';
import { usePassivos, useDeletePassivo, type Passivo } from '@/hooks/usePassivos';
import { brl, formatCnpj, STATUS_BADGE, STATUS_LABELS } from '@/lib/passivos/utils';
import { PassivoFormDialog } from '@/components/passivos/PassivoFormDialog';
import { useToast } from '@/hooks/use-toast';

interface Props {
  canEdit: boolean;
  canDelete: boolean;
}

export default function PassivosList({ canEdit, canDelete }: Props) {
  const { data: rows = [], isLoading } = usePassivos();
  const del = useDeletePassivo();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Passivo | null>(null);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por CNPJ, empresa, acordo ou tipo…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo parcelamento
          </Button>
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
                <TableHead className="text-center">Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Atraso</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhum parcelamento encontrado.</TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.id}>
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${r.parcelas_em_atraso > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                    {r.parcelas_em_atraso}
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PassivoFormDialog open={open} onOpenChange={setOpen} initial={editing} />
    </div>
  );
}
