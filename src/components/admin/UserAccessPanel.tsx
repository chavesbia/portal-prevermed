import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Package, CheckCheck, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Module { id: string; name: string; route: string | null; }
interface Department { id: string; name: string; }
interface DeptModule { department_id: string; module_id: string; }
interface Permission {
  id?: string;
  user_id: string;
  module_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}
type ActionKey = 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_approve';

const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: 'can_view', label: 'Ver' },
  { key: 'can_create', label: 'Criar' },
  { key: 'can_edit', label: 'Editar' },
  { key: 'can_delete', label: 'Excluir' },
  { key: 'can_approve', label: 'Aprovar' },
];
const ALL_KEY = '__all__';

interface Props {
  userId: string;
  onSaved?: () => void;
}

export function UserAccessPanel({ userId, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptModules, setDeptModules] = useState<DeptModule[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [pending, setPending] = useState<Record<string, Partial<Record<ActionKey, boolean>>>>({});
  const [saving, setSaving] = useState(false);
  const [activeDept, setActiveDept] = useState<string>(ALL_KEY);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [userId]);

  const fetchAll = async () => {
    setLoading(true);
    const [modsRes, deptsRes, dmRes, permsRes] = await Promise.all([
      supabase.from('modules').select('id, name, route').eq('is_active', true).order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('department_modules').select('department_id, module_id'),
      supabase.from('permissions').select('id, user_id, module_id, can_view, can_create, can_edit, can_delete, can_approve').eq('user_id', userId).not('module_id', 'is', null),
    ]);
    setModules(modsRes.data || []);
    setDepartments(deptsRes.data || []);
    setDeptModules(dmRes.data || []);
    setPermissions((permsRes.data || []) as Permission[]);
    setPending({});
    setLoading(false);
  };

  const permMap = useMemo(() => {
    const m = new Map<string, Permission>();
    for (const p of permissions) m.set(p.module_id, p);
    return m;
  }, [permissions]);

  const modulesByDept = useMemo(() => {
    const map = new Map<string, Module[]>();
    for (const dm of deptModules) {
      const mod = modules.find(m => m.id === dm.module_id);
      if (!mod) continue;
      if (!map.has(dm.department_id)) map.set(dm.department_id, []);
      const arr = map.get(dm.department_id)!;
      if (!arr.find(x => x.id === mod.id)) arr.push(mod);
    }
    return map;
  }, [deptModules, modules]);

  const modulesForTab = useMemo(() => {
    if (activeDept === ALL_KEY) return [...modules].sort((a, b) => a.name.localeCompare(b.name));
    return (modulesByDept.get(activeDept) || []).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeDept, modules, modulesByDept]);

  const groupedModules = useMemo(() => {
    const list = modulesForTab;
    const buckets = new Map<string, { key: string; parent: Module | null; children: Module[] }>();
    const ensure = (key: string) => {
      if (!buckets.has(key)) buckets.set(key, { key, parent: null, children: [] });
      return buckets.get(key)!;
    };
    for (const m of list) {
      const idx = m.name.indexOf(' - ');
      if (idx > 0) ensure(m.name.slice(0, idx).trim()).children.push(m);
    }
    for (const m of list) {
      const idx = m.name.indexOf(' - ');
      if (idx > 0) continue;
      const key = [...buckets.keys()].find(k => m.name === k || m.name.toLowerCase().includes(k.toLowerCase())) ?? m.name;
      const b = ensure(key);
      if (b.parent) ensure(m.name).parent = m; else b.parent = m;
    }
    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [modulesForTab]);

  const effective = (mid: string, a: ActionKey): boolean => {
    const p = pending[mid];
    if (p && p[a] !== undefined) return !!p[a];
    const perm = permMap.get(mid);
    return perm ? !!perm[a] : false;
  };
  const toggle = (mid: string, a: ActionKey) => {
    const cur = effective(mid, a);
    setPending(prev => ({ ...prev, [mid]: { ...prev[mid], [a]: !cur } }));
  };
  const apply = (ids: string[], values: Partial<Record<ActionKey, boolean>>) => {
    setPending(prev => {
      const n = { ...prev };
      for (const id of ids) n[id] = { ...(n[id] || {}), ...values };
      return n;
    });
  };
  const toggleGroup = (k: string) => setCollapsedGroups(prev => {
    const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
  });
  const groupIds = (g: { parent: Module | null; children: Module[] }) =>
    [g.parent?.id, ...g.children.map(c => c.id)].filter(Boolean) as string[];

  const changesCount = useMemo(() => {
    let c = 0;
    for (const [mid, changes] of Object.entries(pending)) {
      const perm = permMap.get(mid);
      for (const a of ACTIONS) {
        if (changes[a.key] === undefined) continue;
        const original = perm ? !!perm[a.key] : false;
        if (changes[a.key] !== original) c++;
      }
    }
    return c;
  }, [pending, permMap]);

  const handleSave = async () => {
    if (changesCount === 0) return;
    setSaving(true);
    const upserts: Permission[] = [];
    const deletes: string[] = [];
    for (const mid of Object.keys(pending)) {
      const perm = permMap.get(mid);
      const row: Permission = {
        id: perm?.id, user_id: userId, module_id: mid,
        can_view: effective(mid, 'can_view'),
        can_create: effective(mid, 'can_create'),
        can_edit: effective(mid, 'can_edit'),
        can_delete: effective(mid, 'can_delete'),
        can_approve: effective(mid, 'can_approve'),
      };
      const anyTrue = row.can_view || row.can_create || row.can_edit || row.can_delete || row.can_approve;
      if (!anyTrue && perm?.id) deletes.push(perm.id);
      else if (anyTrue) upserts.push(row);
    }
    try {
      if (deletes.length) {
        const { error } = await supabase.from('permissions').delete().in('id', deletes);
        if (error) throw error;
      }
      for (const row of upserts) {
        if (row.id) {
          const { error } = await supabase.from('permissions').update({
            can_view: row.can_view, can_create: row.can_create, can_edit: row.can_edit,
            can_delete: row.can_delete, can_approve: row.can_approve,
          }).eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('permissions').insert({
            user_id: row.user_id, module_id: row.module_id,
            can_view: row.can_view, can_create: row.can_create, can_edit: row.can_edit,
            can_delete: row.can_delete, can_approve: row.can_approve,
          });
          if (error) throw error;
        }
      }
      toast.success(`${changesCount} alteração(ões) salvas`);
      await fetchAll();
      onSaved?.();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e?.message || 'desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-2 p-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 pb-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrar por departamento:</span>
          <Select value={activeDept} onValueChange={setActiveDept}>
            <SelectTrigger className="h-8 text-xs w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_KEY}>Todos os módulos</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {changesCount > 0 && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            {changesCount} alteração(ões) pendente(s)
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 mt-3 pr-2">
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
              <tr>
                <th className="py-2 px-3 text-xs font-bold text-muted-foreground">Módulo</th>
                {ACTIONS.map(a => (
                  <th key={a.key} className="py-2 px-2 text-center text-xs font-bold text-muted-foreground w-20">{a.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groupedModules.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhum módulo.</td></tr>
              ) : groupedModules.map(group => {
                const allMods = [group.parent, ...group.children].filter(Boolean) as Module[];
                const hasChildren = group.children.length > 0;
                const collapsed = collapsedGroups.has(group.key);
                const granted = allMods.filter(mm => ACTIONS.some(a => effective(mm.id, a.key))).length;
                const fully = granted === allMods.length;
                const partial = granted > 0 && !fully;

                const renderRow = (m: Module, isChild: boolean) => {
                  const hasAny = ACTIONS.some(a => effective(m.id, a.key));
                  const dirty = !!pending[m.id];
                  const displayName = isChild ? m.name.replace(new RegExp(`^${group.key}\\s*-\\s*`, 'i'), '') : m.name;
                  return (
                    <tr key={m.id} className={cn('transition-colors', dirty ? 'bg-primary/5' : hasAny ? 'hover:bg-muted/40' : 'hover:bg-muted/20')}>
                      <td className={cn('py-2 px-3', isChild && 'pl-9')}>
                        <div className="flex items-center gap-2">
                          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', hasAny ? 'bg-primary' : 'bg-muted-foreground/20')} />
                          <span className={cn('text-sm', isChild ? 'font-normal text-foreground/80' : 'font-medium', hasAny ? 'text-foreground' : 'text-muted-foreground')}>
                            {displayName}
                          </span>
                          {dirty && <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/40 text-primary">alterado</Badge>}
                        </div>
                      </td>
                      {ACTIONS.map(a => (
                        <td key={a.key} className="py-2 px-2 text-center">
                          <div className="flex justify-center">
                            <Checkbox checked={effective(m.id, a.key)} onCheckedChange={() => toggle(m.id, a.key)} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                };

                return (
                  <Fragment key={group.key}>
                    <tr className="bg-muted/30 border-t-2 border-border/60">
                      <td colSpan={6} className="py-1.5 px-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <button type="button" onClick={() => toggleGroup(group.key)} className="flex items-center gap-1.5 text-sm font-bold text-foreground/90 hover:text-primary">
                            <ChevronRight className={cn('h-4 w-4 transition-transform', !collapsed && 'rotate-90')} />
                            <Package className="h-3.5 w-3.5 text-primary" />
                            {group.key}
                            {hasChildren ? (
                              <Badge variant="outline" className={cn('text-[10px] ml-1',
                                fully && 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300',
                                partial && 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300',
                              )}>{granted}/{allMods.length} liberados</Badge>
                            ) : (
                              <Badge variant="outline" className={cn('text-[10px] ml-1',
                                fully ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300' : 'border-border text-muted-foreground'
                              )}>{fully ? 'liberado' : 'sem acesso'}</Badge>
                            )}
                          </button>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => apply(groupIds(group), { can_view: true })}
                              className="text-[11px] px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                              <CheckCheck className="h-3 w-3" />Liberar
                            </button>
                            <button type="button" onClick={() => apply(groupIds(group), ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: true }), {} as Record<ActionKey, boolean>))}
                              className="text-[11px] px-2 py-1 rounded border border-border text-foreground/70 hover:bg-muted font-semibold whitespace-nowrap">Todas ações</button>
                            <button type="button" onClick={() => apply(groupIds(group), ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: false }), {} as Record<ActionKey, boolean>))}
                              className="text-[11px] px-2 py-1 rounded text-muted-foreground hover:bg-muted font-semibold whitespace-nowrap">Limpar</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {!collapsed && group.parent && renderRow(group.parent, false)}
                    {!collapsed && group.children.map(c => renderRow(c, hasChildren))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-2 pt-3 border-t mt-3">
        <Button variant="ghost" size="sm" onClick={() => setPending({})} disabled={changesCount === 0 || saving}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Descartar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={changesCount === 0 || saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? 'Salvando...' : 'Salvar acessos'}
        </Button>
      </div>
    </div>
  );
}
