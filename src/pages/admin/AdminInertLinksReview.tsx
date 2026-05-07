import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Link2Off, RefreshCw, Search, MapPin, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface InertRow {
  link_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  department_id: string;
  department_name: string;
  modules_count: number;
  module_names: string[];
}

interface RoleTemplate {
  id: string;
  slug: string;
  name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

type ActionKind = 'lotacao' | 'grant' | 'remove' | null;

export default function AdminInertLinksReview() {
  const [rows, setRows] = useState<InertRow[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InertRow | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  const [templateId, setTemplateId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: uds, error: e1 }, { data: dms, error: e2 }, { data: tpls, error: e3 }] = await Promise.all([
        supabase
          .from('user_departments')
          .select('id,user_id,department_id,is_lotacao,departments(name)')
          .eq('is_lotacao', false),
        supabase
          .from('department_modules')
          .select('department_id,module_id,modules(name)'),
        supabase
          .from('role_templates')
          .select('*')
          .order('name'),
      ]);
      if (e1 || e2 || e3) throw e1 || e2 || e3;

      const userIds = [...new Set((uds || []).map((u: any) => u.user_id))];
      const { data: profs, error: ep } = await supabase
        .from('profiles')
        .select('user_id,full_name,email')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
      if (ep) throw ep;
      const profileMap = new Map((profs || []).map((p: any) => [p.user_id, p]));

      const dmByDept = new Map<string, { module_id: string; name: string }[]>();
      for (const dm of (dms || []) as any[]) {
        const arr = dmByDept.get(dm.department_id) || [];
        arr.push({ module_id: dm.module_id, name: (dm.modules as any)?.name || '' });
        dmByDept.set(dm.department_id, arr);
      }

      // find permission table entries per (user, module)
      const candidateUserIds = [...new Set((uds || []).map((u: any) => u.user_id))];
      const candidateModuleIds = [...new Set((dms || []).map((dm: any) => dm.module_id))];
      const { data: perms } = await supabase
        .from('permissions')
        .select('user_id,module_id,can_view')
        .in('user_id', candidateUserIds.length ? candidateUserIds : ['00000000-0000-0000-0000-000000000000'])
        .in('module_id', candidateModuleIds.length ? candidateModuleIds : ['00000000-0000-0000-0000-000000000000']);

      const viewSet = new Set(
        (perms || [])
          .filter((p: any) => p.can_view)
          .map((p: any) => `${p.user_id}:${p.module_id}`)
      );

      const inert: InertRow[] = [];
      for (const ud of (uds || []) as any[]) {
        const mods = dmByDept.get(ud.department_id) || [];
        if (mods.length === 0) continue; // dept without modules — already lotação candidates
        const hasAnyView = mods.some((m) => viewSet.has(`${ud.user_id}:${m.module_id}`));
        if (hasAnyView) continue;
        inert.push({
          link_id: ud.id,
          user_id: ud.user_id,
          user_name: (ud.profiles as any)?.full_name ?? null,
          user_email: (ud.profiles as any)?.email ?? null,
          department_id: ud.department_id,
          department_name: (ud.departments as any)?.name ?? '—',
          modules_count: mods.length,
          module_names: mods.map((m) => m.name),
        });
      }
      inert.sort((a, b) =>
        (a.user_name || '').localeCompare(b.user_name || '') ||
        a.department_name.localeCompare(b.department_name)
      );
      setRows(inert);
      setTemplates((tpls || []) as RoleTemplate[]);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar vínculos inertes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      [r.user_name, r.user_email, r.department_name].some((v) => v?.toLowerCase().includes(s))
    );
  }, [rows, search]);

  const openAction = (row: InertRow, kind: ActionKind) => {
    setSelected(row);
    setAction(kind);
    setTemplateId('');
  };

  const closeDialog = () => {
    setSelected(null); setAction(null); setTemplateId('');
  };

  const submit = async () => {
    if (!selected || !action) return;
    setSubmitting(true);
    try {
      if (action === 'lotacao') {
        const { error } = await supabase
          .from('user_departments')
          .update({ is_lotacao: true })
          .eq('id', selected.link_id);
        if (error) throw error;
        toast.success('Vínculo marcado como lotação organizacional');
      } else if (action === 'remove') {
        const { error } = await supabase
          .from('user_departments')
          .delete()
          .eq('id', selected.link_id);
        if (error) throw error;
        toast.success('Vínculo removido');
      } else if (action === 'grant') {
        if (!templateId) {
          toast.error('Selecione um template');
          setSubmitting(false);
          return;
        }
        const tpl = templates.find((t) => t.id === templateId);
        if (!tpl) throw new Error('Template não encontrado');

        const { data: dms, error: e1 } = await supabase
          .from('department_modules')
          .select('module_id')
          .eq('department_id', selected.department_id);
        if (e1) throw e1;

        const moduleIds = (dms || []).map((d: any) => d.module_id);
        if (moduleIds.length === 0) {
          toast.error('Departamento não possui módulos');
          setSubmitting(false);
          return;
        }

        const { data: existing } = await supabase
          .from('permissions')
          .select('id,module_id')
          .eq('user_id', selected.user_id)
          .in('module_id', moduleIds);

        const existingMap = new Map((existing || []).map((p: any) => [p.module_id, p.id]));
        const flags = {
          can_view: tpl.can_view,
          can_create: tpl.can_create,
          can_edit: tpl.can_edit,
          can_delete: tpl.can_delete,
          can_approve: tpl.can_approve,
        };

        const toInsert: any[] = [];
        const toUpdate: { id: string }[] = [];
        for (const mid of moduleIds) {
          const existId = existingMap.get(mid);
          if (existId) toUpdate.push({ id: existId });
          else toInsert.push({
            user_id: selected.user_id,
            module_id: mid,
            department_id: selected.department_id,
            ...flags,
          });
        }

        if (toInsert.length > 0) {
          const { error: ei } = await supabase.from('permissions').insert(toInsert);
          if (ei) throw ei;
        }
        if (toUpdate.length > 0) {
          const { error: eu } = await supabase
            .from('permissions')
            .update(flags)
            .in('id', toUpdate.map((u) => u.id));
          if (eu) throw eu;
        }
        toast.success(`Acesso concedido com template "${tpl.name}"`);
      }
      closeDialog();
      load();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao executar ação');
    } finally {
      setSubmitting(false);
    }
  };

  const dialogTitle =
    action === 'lotacao' ? 'Marcar como lotação organizacional' :
    action === 'grant' ? 'Conceder acesso via template' :
    action === 'remove' ? 'Remover vínculo' : '';

  const dialogDesc =
    action === 'lotacao' ? 'O vínculo deixará de ser considerado para acesso e passará a representar apenas a lotação organizacional do usuário no departamento.' :
    action === 'grant' ? 'Será criada (ou atualizada) uma permissão por módulo do departamento, com as flags do template selecionado.' :
    action === 'remove' ? 'O vínculo será removido permanentemente. Use quando o usuário não pertence mais ao departamento.' : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2Off className="h-6 w-6 text-primary" />
            Revisão de Vínculos Inertes
          </h1>
          <p className="text-sm text-muted-foreground">
            Usuários vinculados a departamentos com módulos, mas sem nenhuma permissão de visualização. Decida: marcar como lotação, conceder acesso via template ou remover o vínculo.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">
              {filtered.length} vínculo(s) inerte(s)
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar usuário ou departamento..."
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Módulos do depto</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Carregando...' : 'Nenhum vínculo inerte encontrado'}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.link_id}>
                    <TableCell>
                      <div className="font-medium">{r.user_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{r.user_email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.department_name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{r.modules_count}</Badge>
                        {r.module_names.slice(0, 3).map((m) => (
                          <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                        ))}
                        {r.module_names.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{r.module_names.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openAction(r, 'lotacao')}>
                        <MapPin className="h-3.5 w-3.5 mr-1" /> Lotação
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openAction(r, 'grant')}>
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Conceder
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => openAction(r, 'remove')}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected && !!action} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDesc}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Usuário: </span>
                <span className="font-medium">{selected.user_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Departamento: </span>
                <span className="font-medium">{selected.department_name}</span>
                <span className="text-muted-foreground"> ({selected.modules_count} módulos)</span>
              </div>
              {action === 'grant' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template</label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({[
                              t.can_view && 'V',
                              t.can_create && 'C',
                              t.can_edit && 'E',
                              t.can_delete && 'D',
                              t.can_approve && 'A',
                            ].filter(Boolean).join('+') || '—'})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>Cancelar</Button>
            <Button
              onClick={submit}
              disabled={submitting || (action === 'grant' && !templateId)}
              variant={action === 'remove' ? 'destructive' : 'default'}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
