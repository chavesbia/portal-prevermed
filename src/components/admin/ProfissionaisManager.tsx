import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, Pencil, ShieldCheck } from 'lucide-react';
import { useProfissionais } from '@/hooks/useProfissionais';
import { Profissional } from '@/types/profissionais';
import { ProfissionalFormDialog } from '@/components/os/ProfissionalFormDialog';

export function ProfissionaisManager() {
  const { profissionais, isLoading, toggleAtivo } = useProfissionais();
  const [search, setSearch] = useState('');
  const [showInativos, setShowInativos] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Sempre derivar do dado fresco da lista (evita objeto "selecionado" desatualizado)
  const editing: Profissional | null = useMemo(
    () => (editingId ? profissionais.find(p => p.id === editingId) ?? null : null),
    [editingId, profissionais],
  );


  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profissionais.filter(p => {
      if (!showInativos && !p.ativo) return false;
      if (!q) return true;
      return [p.nome, p.categoria, p.conselho_sigla, p.numero_conselho, p.especialidade]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [profissionais, search, showInativos]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Profissionais</CardTitle>
          <CardDescription>
            Cadastro único de profissionais internos e externos. Marcando “Pode ser Responsável Técnico”,
            o registro de Responsável Técnico usado em Laudos e OS é mantido automaticamente.
          </CardDescription>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />Novo Profissional
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome, categoria, conselho…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="prof-inativos" checked={showInativos} onCheckedChange={setShowInativos} />
            <label htmlFor="prof-inativos" className="text-sm cursor-pointer">Mostrar inativos</label>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conselho / Registro</TableHead>
                <TableHead>Resp. Técnico</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum profissional encontrado.</TableCell></TableRow>
              ) : rows.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.categoria}</TableCell>
                  <TableCell>{p.tipo === 'interno' ? 'Interno' : 'Externo'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.conselho_sigla ? `${p.conselho_sigla} ${p.numero_conselho || ''}` : '—'}
                  </TableCell>
                  <TableCell>
                    {p.pode_ser_responsavel_tecnico ? (
                      <Badge className="bg-emerald-600 text-white gap-1">
                        <ShieldCheck className="h-3 w-3" />Sim
                      </Badge>
                    ) : (
                      <Badge variant="outline">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={p.ativo} onCheckedChange={v => toggleAtivo(p.id, v)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <ProfissionalFormDialog open={open} onOpenChange={setOpen} profissional={editing} />
    </Card>
  );
}
