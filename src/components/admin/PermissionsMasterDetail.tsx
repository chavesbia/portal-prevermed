import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Copy, Save, RotateCcw, ShieldCheck, Users2, Building2, Package, ChevronRight, CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Module {
  id: string;
  name: string;
  route: string | null;
}
interface Department {
  id: string;
  name: string;
}
interface DeptModule {
  department_id: string;
  module_id: string;
}
interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  contact_email: string | null;
  position: string | null;
  unit: string | null;
  status: string | null;
}
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
  { key: 'can_view', label: 'Visualizar' },
  { key: 'can_create', label: 'Criar' },
  { key: 'can_edit', label: 'Editar' },
  { key: 'can_delete', label: 'Excluir' },
  { key: 'can_approve', label: 'Aprovar' },
];

const ALL_KEY = '__all__';

export function PermissionsMasterDetail() {
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptModules, setDeptModules] = useState<DeptModule[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeDept, setActiveDept] = useState<string>(ALL_KEY);

  const [pending, setPending] = useState<Record<string, Partial<Record<ActionKey, boolean>>>>({});
  const [saving, setSaving] = useState(false);
  const [copyFromUser, setCopyFromUser] = useState<string>('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [modsRes, deptsRes, dmRes, usersRes, permsRes] = await Promise.all([
      supabase.from('modules').select('id, name, route').eq('is_active', true).order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('department_modules').select('department_id, module_id'),
      supabase.from('profiles').select('user_id, full_name, email, contact_email, position, unit, status').order('full_name'),
      supabase.from('permissions').select('id, user_id, module_id, can_view, can_create, can_edit, can_delete, can_approve').not('module_id', 'is', null),
    ]);
    setModules(modsRes.data || []);
    setDepartments(deptsRes.data || []);
    setDeptModules(dmRes.data || []);
    setUsers(usersRes.data || []);
    setPermissions((permsRes.data || []) as Permission[]);
    setLoading(false);
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(u => {
      if (unitFilter !== 'all' && (u.unit || '') !== unitFilter) return false;
      if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
      if (!term) return true;
      const email = (u.contact_email || u.email || '').toLowerCase();
      return u.full_name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
    });
  }, [users, search, unitFilter, statusFilter]);

  const userModuleCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of permissions) {
      if (p.can_view || p.can_create || p.can_edit || p.can_delete || p.can_approve) {
        map.set(p.user_id, (map.get(p.user_id) || 0) + 1);
      }
    }
    return map;
  }, [permissions]);

  const selectedUser = users.find(u => u.user_id === selectedUserId) || null;

  const userPermMap = useMemo(() => {
    const map = new Map<string, Permission>();
    if (!selectedUserId) return map;
    for (const p of permissions) {
      if (p.user_id === selectedUserId) map.set(p.module_id, p);
    }
    return map;
  }, [permissions, selectedUserId]);

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

  const modulesForActiveTab = useMemo(() => {
    if (activeDept === ALL_KEY) return [...modules].sort((a, b) => a.name.localeCompare(b.name));
    return (modulesByDept.get(activeDept) || []).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeDept, modules, modulesByDept]);

  /**
   * Agrupa módulos hierarquicamente pela convenção de nome:
   *   "Feedback - Avaliações" → grupo "Feedback"
   *   "Gestão de Feedback"    → módulo raiz do grupo "Gestão de Feedback"
   * Se existir um módulo raiz cujo nome coincida com o prefixo (ou contenha o prefixo),
   * ele é usado como "pai"; os demais viram filhos. Módulos sem sub-permissões
   * viram grupos de 1 item só (sem cabeçalho extra).
   */
  const groupedModules = useMemo(() => {
    const list = modulesForActiveTab;
    // Módulos com " - " são "filhos" — o texto antes do primeiro " - " é a chave do grupo
    const buckets = new Map<string, { key: string; parent: Module | null; children: Module[] }>();

    const ensure = (key: string) => {
      if (!buckets.has(key)) buckets.set(key, { key, parent: null, children: [] });
      return buckets.get(key)!;
    };

    // primeiro os filhos, para saber quais chaves têm subitens
    for (const m of list) {
      const idx = m.name.indexOf(' - ');
      if (idx > 0) {
        const key = m.name.slice(0, idx).trim();
        ensure(key).children.push(m);
      }
    }
    // agora os pais / módulos avulsos
    for (const m of list) {
      const idx = m.name.indexOf(' - ');
      if (idx > 0) continue;
      // tenta casar como pai de algum bucket (match exato ou o bucket contido no nome)
      const key =
        [...buckets.keys()].find(k => m.name === k || m.name.toLowerCase().includes(k.toLowerCase())) ??
        m.name;
      const b = ensure(key);
      // primeiro pai vence; se já existe pai, vira "avulso" próprio
      if (b.parent) ensure(m.name).parent = m;
      else b.parent = m;
    }
    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [modulesForActiveTab]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  // Effective value considering pending edits
  const effectiveValue = (moduleId: string, action: ActionKey): boolean => {
    const p = pending[moduleId];
    if (p && p[action] !== undefined) return !!p[action];
    const perm = userPermMap.get(moduleId);
    return perm ? !!perm[action] : false;
  };

  const toggle = (moduleId: string, action: ActionKey) => {
    const current = effectiveValue(moduleId, action);
    setPending(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [action]: !current },
    }));
  };

  const applyToModules = (moduleIds: string[], values: Partial<Record<ActionKey, boolean>>) => {
    setPending(prev => {
      const next = { ...prev };
      for (const id of moduleIds) {
        next[id] = { ...(next[id] || {}), ...values };
      }
      return next;
    });
  };

  const markAllInTab = (value: boolean) => {
    const values = ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: value }), {} as Record<ActionKey, boolean>);
    applyToModules(modulesForActiveTab.map(m => m.id), values);
  };

  // Marca "Visualizar" em todos os módulos do grupo (pai + filhos)
  const releaseGroupView = (group: { parent: Module | null; children: Module[] }) => {
    const ids = [group.parent?.id, ...group.children.map(c => c.id)].filter(Boolean) as string[];
    applyToModules(ids, { can_view: true });
  };
  // Marca todas as ações em todos os módulos do grupo
  const releaseGroupFull = (group: { parent: Module | null; children: Module[] }) => {
    const ids = [group.parent?.id, ...group.children.map(c => c.id)].filter(Boolean) as string[];
    const values = ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: true }), {} as Record<ActionKey, boolean>);
    applyToModules(ids, values);
  };
  const clearGroup = (group: { parent: Module | null; children: Module[] }) => {
    const ids = [group.parent?.id, ...group.children.map(c => c.id)].filter(Boolean) as string[];
    const values = ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: false }), {} as Record<ActionKey, boolean>);
    applyToModules(ids, values);
  };


  const changesCount = useMemo(() => {
    let c = 0;
    for (const [mid, changes] of Object.entries(pending)) {
      const perm = userPermMap.get(mid);
      for (const a of ACTIONS) {
        if (changes[a.key] === undefined) continue;
        const original = perm ? !!perm[a.key] : false;
        if (changes[a.key] !== original) c++;
      }
    }
    return c;
  }, [pending, userPermMap]);

  const handleSelectUser = (id: string) => {
    if (changesCount > 0) {
      if (!confirm(`Existem ${changesCount} alteração(ões) não salvas. Descartar?`)) return;
    }
    setSelectedUserId(id);
    setPending({});
    setActiveDept(ALL_KEY);
  };

  const handleReset = () => {
    setPending({});
  };

  const handleSave = async () => {
    if (!selectedUserId || changesCount === 0) return;
    setSaving(true);

    const rowsToUpsert: Permission[] = [];
    const idsToDelete: string[] = [];

    for (const mid of Object.keys(pending)) {
      const perm = userPermMap.get(mid);
      const row: Permission = {
        id: perm?.id,
        user_id: selectedUserId,
        module_id: mid,
        can_view: effectiveValue(mid, 'can_view'),
        can_create: effectiveValue(mid, 'can_create'),
        can_edit: effectiveValue(mid, 'can_edit'),
        can_delete: effectiveValue(mid, 'can_delete'),
        can_approve: effectiveValue(mid, 'can_approve'),
      };
      const anyTrue = row.can_view || row.can_create || row.can_edit || row.can_delete || row.can_approve;
      if (!anyTrue && perm?.id) {
        idsToDelete.push(perm.id);
      } else if (anyTrue) {
        rowsToUpsert.push(row);
      }
    }

    try {
      if (idsToDelete.length) {
        const { error } = await supabase.from('permissions').delete().in('id', idsToDelete);
        if (error) throw error;
      }
      for (const row of rowsToUpsert) {
        if (row.id) {
          const { error } = await supabase
            .from('permissions')
            .update({
              can_view: row.can_view, can_create: row.can_create, can_edit: row.can_edit,
              can_delete: row.can_delete, can_approve: row.can_approve,
            })
            .eq('id', row.id);
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
      setPending({});
      await fetchAll();
    } catch (e: any) {
      toast.error('Erro ao salvar permissões: ' + (e?.message || 'desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFrom = () => {
    if (!copyFromUser || !selectedUserId) return;
    const sourcePerms = permissions.filter(p => p.user_id === copyFromUser);
    const next: typeof pending = { ...pending };
    // Start clean for all modules being copied
    for (const p of sourcePerms) {
      next[p.module_id] = {
        can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit,
        can_delete: p.can_delete, can_approve: p.can_approve,
      };
    }
    setPending(next);
    setCopyFromUser('');
    toast.info('Permissões carregadas — revise e clique em Salvar');
  };

  const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();

  const unitLabel = (u: string | null) => {
    if (!u) return '—';
    return u === 'lapa' ? 'Lapa' : u === 'osasco' ? 'Osasco' : u;
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card flex h-[calc(100vh-16rem)] min-h-[600px]">
      {/* Master column */}
      <aside className="w-80 border-r border-border flex flex-col bg-muted/30">
        <div className="p-4 border-b border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              Usuários
            </h2>
            <Badge variant="secondary" className="text-[10px]">{filteredUsers.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas unidades</SelectItem>
                <SelectItem value="lapa">Lapa</SelectItem>
                <SelectItem value="osasco">Osasco</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <ul>
              {filteredUsers.map(u => {
                const active = u.user_id === selectedUserId;
                const modCount = userModuleCount.get(u.user_id) || 0;
                const isActive = (u.status || 'active') === 'active';
                return (
                  <li key={u.user_id}>
                    <button
                      onClick={() => handleSelectUser(u.user_id)}
                      className={cn(
                        'w-full text-left p-3 border-b border-border transition-colors',
                        active
                          ? 'bg-card border-l-4 border-l-primary'
                          : 'hover:bg-muted border-l-4 border-l-transparent'
                      )}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className={cn(
                          'text-sm font-medium truncate',
                          active ? 'text-foreground' : 'text-foreground/80'
                        )}>
                          {u.full_name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-bold uppercase shrink-0',
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {u.position || 'Sem cargo'}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] uppercase tracking-tight text-muted-foreground">
                          {unitLabel(u.unit)}
                        </span>
                        {modCount > 0 && (
                          <span className="text-[10px] font-semibold text-primary">
                            {modCount} módulo{modCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* Detail column */}
      <main className="flex-1 flex flex-col min-w-0 bg-card">
        {!selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <ShieldCheck className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">Selecione um usuário</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Escolha um usuário na lista à esquerda para visualizar e gerenciar suas permissões por módulo.
            </p>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <header className="p-5 border-b border-border flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {initials(selectedUser.full_name)}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold truncate">{selectedUser.full_name}</h1>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedUser.position || 'Sem cargo'} • {unitLabel(selectedUser.unit)} • {selectedUser.contact_email || selectedUser.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={copyFromUser} onValueChange={setCopyFromUser}>
                  <SelectTrigger className="h-9 text-xs w-56">
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue placeholder="Copiar de outro usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter(u => u.user_id !== selectedUserId && (userModuleCount.get(u.user_id) || 0) > 0)
                      .map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.full_name} ({userModuleCount.get(u.user_id)} mód.)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={handleCopyFrom} disabled={!copyFromUser}>
                  Aplicar
                </Button>
              </div>
            </header>

            {/* Dept tabs */}
            <div className="px-5 pt-3 border-b border-border overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                <button
                  onClick={() => setActiveDept(ALL_KEY)}
                  className={cn(
                    'pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
                    activeDept === ALL_KEY
                      ? 'text-primary border-primary'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  )}
                >
                  <Package className="h-3.5 w-3.5" />
                  Todos ({modules.length})
                </button>
                {departments.map(d => {
                  const count = (modulesByDept.get(d.id) || []).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setActiveDept(d.id)}
                      className={cn(
                        'pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap',
                        activeDept === d.id
                          ? 'text-primary border-primary'
                          : 'text-muted-foreground hover:text-foreground border-transparent'
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {d.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Matrix */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Módulos {activeDept !== ALL_KEY && `— ${departments.find(d => d.id === activeDept)?.name}`}
                </h3>
                <div className="flex gap-2">
                  <button
                    className="text-xs text-primary font-semibold hover:underline"
                    onClick={() => markAllInTab(true)}
                  >
                    Marcar todos
                  </button>
                  <span className="text-muted-foreground/40">•</span>
                  <button
                    className="text-xs text-muted-foreground font-semibold hover:underline"
                    onClick={() => markAllInTab(false)}
                  >
                    Desmarcar todos
                  </button>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 text-xs font-bold text-muted-foreground">Módulo</th>
                      {ACTIONS.map(a => (
                        <th key={a.key} className="py-2.5 px-2 text-center text-xs font-bold text-muted-foreground w-24">
                          {a.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {modulesForActiveTab.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhum módulo nesta categoria.
                        </td>
                      </tr>
                    ) : (
                      groupedModules.map(group => {
                        const allMods = [group.parent, ...group.children].filter(Boolean) as Module[];
                        const hasChildren = group.children.length > 0;
                        const collapsed = collapsedGroups.has(group.key);
                        // contagem de acessos concedidos no grupo
                        const grantedCount = allMods.filter(mm =>
                          ACTIONS.some(a => effectiveValue(mm.id, a.key))
                        ).length;
                        const fullyGranted = grantedCount === allMods.length;
                        const partiallyGranted = grantedCount > 0 && !fullyGranted;

                        const renderRow = (m: Module, isChild: boolean) => {
                          const hasAny = ACTIONS.some(a => effectiveValue(m.id, a.key));
                          const isDirty = !!pending[m.id];
                          // remove o prefixo do grupo do label do filho
                          const displayName = isChild
                            ? m.name.replace(new RegExp(`^${group.key}\\s*-\\s*`, 'i'), '')
                            : m.name;
                          return (
                            <tr
                              key={m.id}
                              className={cn(
                                'transition-colors',
                                isDirty ? 'bg-primary/5' : hasAny ? 'hover:bg-muted/40' : 'hover:bg-muted/20'
                              )}
                            >
                              <td className={cn('py-2.5 px-4', isChild && 'pl-10')}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full shrink-0',
                                      hasAny ? 'bg-primary' : 'bg-muted-foreground/20'
                                    )}
                                  />
                                  <span className={cn(
                                    'text-sm',
                                    isChild ? 'font-normal text-foreground/80' : 'font-medium',
                                    hasAny ? 'text-foreground' : 'text-muted-foreground'
                                  )}>
                                    {displayName}
                                  </span>
                                  {isDirty && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/40 text-primary">
                                      alterado
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              {ACTIONS.map(a => (
                                <td key={a.key} className="py-2.5 px-2 text-center">
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={effectiveValue(m.id, a.key)}
                                      onCheckedChange={() => toggle(m.id, a.key)}
                                    />
                                  </div>
                                </td>
                              ))}
                            </tr>
                          );
                        };

                        return (
                          <Fragment key={group.key}>

                            {hasChildren && (
                              <tr key={`grp-${group.key}`} className="bg-muted/30 border-t-2 border-border/60">
                                <td colSpan={6} className="py-2 px-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleGroup(group.key)}
                                      className="flex items-center gap-1.5 text-sm font-bold text-foreground/90 hover:text-primary"
                                    >
                                      <ChevronRight
                                        className={cn(
                                          'h-4 w-4 transition-transform',
                                          !collapsed && 'rotate-90'
                                        )}
                                      />
                                      <Package className="h-3.5 w-3.5 text-primary" />
                                      {group.key}
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[10px] ml-1',
                                          fullyGranted && 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300',
                                          partiallyGranted && 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300',
                                        )}
                                      >
                                        {grantedCount}/{allMods.length} liberados
                                      </Badge>
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => releaseGroupView(group)}
                                        className="text-[11px] px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 font-semibold inline-flex items-center gap-1"
                                        title="Marca 'Visualizar' no módulo raiz e em todas as sub-áreas"
                                      >
                                        <CheckCheck className="h-3 w-3" />
                                        Liberar acesso completo
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => releaseGroupFull(group)}
                                        className="text-[11px] px-2 py-1 rounded border border-border text-foreground/70 hover:bg-muted font-semibold"
                                        title="Marca TODAS as ações (Visualizar/Criar/Editar/Excluir/Aprovar) em todas as sub-áreas"
                                      >
                                        Todas as ações
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => clearGroup(group)}
                                        className="text-[11px] px-2 py-1 rounded text-muted-foreground hover:bg-muted font-semibold"
                                      >
                                        Limpar
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {!collapsed && group.parent && renderRow(group.parent, false)}
                            {!collapsed && group.children.map(c => renderRow(c, hasChildren))}
                          </>
                        );
                      })
                    )}
                  </tbody>

                </table>
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{modulesForActiveTab.length} módulo(s) nesta categoria</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Acesso concedido
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                    Sem acesso
                  </span>
                </div>
              </div>
            </div>

            {/* Sticky footer */}
            <footer className="p-4 border-t border-border bg-muted/30 flex justify-between items-center gap-3">
              <div className="text-xs text-muted-foreground">
                {changesCount > 0 ? (
                  <span className="font-semibold text-primary">
                    {changesCount} alteração(ões) pendente(s)
                  </span>
                ) : (
                  'Nenhuma alteração pendente'
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={changesCount === 0 || saving}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Descartar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={changesCount === 0 || saving}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? 'Salvando...' : 'Salvar Permissões'}
                </Button>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
