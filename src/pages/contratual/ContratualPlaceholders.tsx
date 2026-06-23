import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Power, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useContractPlaceholders, PLACEHOLDER_GRUPOS, type ContractPlaceholder } from '@/hooks/useContractPlaceholders';
import { useAuth } from '@/contexts/AuthContext';

const grupoLabel = (g: string) => PLACEHOLDER_GRUPOS.find(x => x.key === g)?.label || g;

export default function ContratualPlaceholders() {
  const { isAdmMaster } = useAuth() as any;
  const canEdit = !!isAdmMaster;
  const qc = useQueryClient();
  const { data: placeholders = [], isLoading } = useContractPlaceholders(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContractPlaceholder | null>(null);

  const grouped = PLACEHOLDER_GRUPOS.map(g => ({
    ...g,
    items: placeholders.filter(p => p.grupo === g.key),
  })).filter(g => g.items.length > 0);

  const toggleAtivo = async (p: ContractPlaceholder) => {
    const { error } = await supabase.from('contract_placeholders').update({ ativo: !p.ativo }).eq('id', p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(p.ativo ? 'Placeholder desativado' : 'Placeholder ativado');
      qc.invalidateQueries({ queryKey: ['contract_placeholders'] });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Campos dinâmicos disponíveis nos modelos. Apenas ADM Master pode criar, editar ou desativar.
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo placeholder
          </Button>
        )}
      </div>

      {isLoading && <div className="text-center py-6 text-muted-foreground text-sm">Carregando…</div>}

      {grouped.map(g => (
        <Card key={g.key}>
          <CardContent className="p-0">
            <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
              <Badge variant="secondary">{g.label}</Badge>
              <span className="text-xs text-muted-foreground">{g.items.length} placeholders</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-72">Chave</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-20">Ordem</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.items.map(p => (
                  <TableRow key={p.id} className={!p.ativo ? 'opacity-60' : ''}>
                    <TableCell><code className="text-primary text-xs">{`{{${p.chave}}}`}</code></TableCell>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.descricao || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{p.ordem}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={p.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200'}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canEdit && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(p); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleAtivo(p)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <PlaceholderDialog open={open} onOpenChange={setOpen} placeholder={editing}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['contract_placeholders'] }); setOpen(false); }} />
    </div>
  );
}

function PlaceholderDialog({ open, onOpenChange, placeholder, onSaved }: {
  open: boolean; onOpenChange: (b: boolean) => void;
  placeholder: ContractPlaceholder | null; onSaved: () => void;
}) {
  const [chave, setChave] = useState('');
  const [label, setLabel] = useState('');
  const [descricao, setDescricao] = useState('');
  const [grupo, setGrupo] = useState('outros');
  const [ordem, setOrdem] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // reset on open
  useState(() => {});
  // simple effect via key
  if (open && placeholder && chave !== placeholder.chave) {
    setChave(placeholder.chave);
    setLabel(placeholder.label);
    setDescricao(placeholder.descricao || '');
    setGrupo(placeholder.grupo);
    setOrdem(placeholder.ordem);
  }
  if (open && !placeholder && chave && !label) {
    // editing -> creating transition handled below
  }

  const handleOpenChange = (b: boolean) => {
    if (!b) {
      setChave(''); setLabel(''); setDescricao(''); setGrupo('outros'); setOrdem(0);
    }
    onOpenChange(b);
  };

  const save = async () => {
    const normChave = chave.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!normChave) return toast.error('Informe a chave');
    if (!label.trim()) return toast.error('Informe o label');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        chave: normChave, label: label.trim(), descricao: descricao.trim() || null,
        grupo, ordem: Number(ordem) || 0, updated_by: user?.id,
      };
      if (placeholder?.id) {
        const { error } = await supabase.from('contract_placeholders').update(payload).eq('id', placeholder.id);
        if (error) throw error;
        toast.success('Placeholder atualizado');
      } else {
        const { error } = await supabase.from('contract_placeholders').insert({ ...payload, created_by: user?.id, ativo: true });
        if (error) throw error;
        toast.success('Placeholder criado');
      }
      handleOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{placeholder ? 'Editar placeholder' : 'Novo placeholder'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Chave *</Label>
            <Input value={chave} onChange={e => setChave(e.target.value)}
              placeholder="Ex.: VALOR_MENSAL" disabled={!!placeholder} />
            <p className="text-xs text-muted-foreground">Será usado como <code>{`{{${(chave || 'CHAVE').toUpperCase()}}}`}</code> nos modelos.</p>
          </div>
          <div className="space-y-1">
            <Label>Label *</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex.: Valor Mensal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Grupo</Label>
              <Select value={grupo} onValueChange={setGrupo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLACEHOLDER_GRUPOS.map(g => (
                    <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ordem</Label>
              <Input type="number" value={ordem} onChange={e => setOrdem(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Explique de onde vem o valor (opcional)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {placeholder ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
