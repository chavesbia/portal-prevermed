import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useRetificacaoAreas, useRetificacaoMotivos, useRetificacaoMedicos, CatalogItem,
} from '@/hooks/useRetificacaoCatalog';

type Catalog = 'areas' | 'motivos' | 'medicos';

const tableMap: Record<Catalog, string> = {
  areas: 'aso_retificacao_areas',
  motivos: 'aso_retificacao_motivos',
  medicos: 'aso_retificacao_medicos_examinadores',
};

function CatalogManager({
  title, catalog, items, queryKey, showCrm = false,
}: {
  title: string;
  catalog: Catalog;
  items: CatalogItem[];
  queryKey: string;
  showCrm?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [nome, setNome] = useState('');
  const [crm, setCrm] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openNew = () => { setEditing(null); setNome(''); setCrm(''); setIsActive(true); setDialogOpen(true); };
  const openEdit = (item: CatalogItem) => {
    setEditing(item); setNome(item.nome); setCrm(item.crm || ''); setIsActive(item.is_active); setDialogOpen(true);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: [queryKey] });

  const save = async () => {
    if (!nome.trim()) { toast.error('Nome obrigatório.'); return; }
    const payload: any = { nome: nome.trim(), is_active: isActive };
    if (showCrm) payload.crm = crm.trim() || null;
    if (editing) {
      const { error } = await supabase.from(tableMap[catalog] as any).update(payload).eq('id', editing.id);
      if (error) { toast.error('Erro: ' + error.message); return; }
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from(tableMap[catalog] as any).insert(payload);
      if (error) { toast.error('Erro: ' + error.message); return; }
    }
    toast.success('Salvo.');
    setDialogOpen(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Inativar este item?')) return;
    const { error } = await supabase.from(tableMap[catalog] as any).update({ is_active: false }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item cadastrado.</p>
        ) : (
          <ul className="space-y-1">
            {items.map(it => (
              <li key={it.id} className="flex items-center justify-between p-2 border rounded-md">
                <div>
                  <span className={it.is_active ? '' : 'line-through text-muted-foreground'}>
                    {it.nome}{showCrm && it.crm ? ` — ${it.crm}` : ''}
                  </span>
                  {!it.is_active && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(it)}><Pencil className="h-4 w-4" /></Button>
                  {it.is_active && (
                    <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Novo'} — {title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            {showCrm && (
              <div>
                <Label>CRM</Label>
                <Input value={crm} onChange={e => setCrm(e.target.value)} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function RetificacaoSettings() {
  const { data: areas = [] } = useRetificacaoAreas(true);
  const { data: motivos = [] } = useRetificacaoMotivos(true);
  const { data: medicos = [] } = useRetificacaoMedicos(true);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CatalogManager title="Áreas" catalog="areas" items={areas} queryKey="retificacao-areas" />
      <CatalogManager title="Motivos" catalog="motivos" items={motivos} queryKey="retificacao-motivos" />
      <CatalogManager title="Médicos Examinadores" catalog="medicos" items={medicos} queryKey="retificacao-medicos" showCrm />
    </div>
  );
}
