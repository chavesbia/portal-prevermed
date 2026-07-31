import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProfissionais } from '@/hooks/useProfissionais';
import { ProfissionalFormDialog } from './ProfissionalFormDialog';
import { Profissional } from '@/types/profissionais';

interface Props {
  canEdit: boolean;
}

export function OSProfissionaisView({ canEdit }: Props) {
  const { profissionais, isLoading, toggleAtivo, remove } = useProfissionais();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'interno' | 'externo'>('todos');
  const [ativos, setAtivos] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const editing: Profissional | null = useMemo(
    () => (editingId ? profissionais.find(p => p.id === editingId) ?? null : null),
    [editingId, profissionais],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return profissionais.filter(p => {
      if (tipo !== 'todos' && p.tipo !== tipo) return false;
      if (ativos === 'ativos' && !p.ativo) return false;
      if (ativos === 'inativos' && p.ativo) return false;
      if (!s) return true;
      return (
        p.nome.toLowerCase().includes(s) ||
        p.categoria.toLowerCase().includes(s) ||
        (p.conselho_sigla || '').toLowerCase().includes(s) ||
        (p.numero_conselho || '').toLowerCase().includes(s) ||
        (p.email || '').toLowerCase().includes(s)
      );
    });
  }, [profissionais, q, tipo, ativos]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" /> Profissionais
          </h2>
          <p className="text-muted-foreground text-sm">Profissionais internos e externos responsáveis pelos serviços das OS.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditingId(null); setShowForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Profissional
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome, categoria, conselho…" className="pl-9" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {(['todos', 'interno', 'externo'] as const).map(t => (
                <Button key={t} variant={tipo === t ? 'default' : 'outline'} size="sm" onClick={() => setTipo(t)}>
                  {t === 'todos' ? 'Todos' : t === 'interno' ? 'Internos' : 'Externos'}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['ativos', 'inativos', 'todos'] as const).map(a => (
                <Button key={a} variant={ativos === a ? 'default' : 'outline'} size="sm" onClick={() => setAtivos(a)}>
                  {a === 'ativos' ? 'Ativos' : a === 'inativos' ? 'Inativos' : 'Todos'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhum profissional encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Categoria</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Tipo</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Conselho</th>
                    
                    <th className="pb-2 text-center font-medium text-muted-foreground">Ativo</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 font-medium">{p.nome}</td>
                      <td className="py-2">{p.categoria}</td>
                      <td className="py-2">
                        <Badge variant={p.tipo === 'interno' ? 'default' : 'secondary'}>
                          {p.tipo === 'interno' ? 'Interno' : 'Externo'}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {p.conselho_sigla ? `${p.conselho_sigla} ${p.numero_conselho || ''}` : '—'}
                      </td>
                      <td className="py-2 text-center">

                        <Switch
                          checked={p.ativo}
                          onCheckedChange={v => toggleAtivo(p.id, v)}
                          disabled={!canEdit}
                        />
                      </td>
                      <td className="py-2 text-right">
                        {canEdit && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingId(p.id); setShowForm(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProfissionalFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        profissional={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se o profissional já foi vinculado a serviços, considere apenas desativá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (deleteId) { await remove(deleteId); setDeleteId(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
