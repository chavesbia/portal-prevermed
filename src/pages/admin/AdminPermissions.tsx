import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, Plus, Trash2, RefreshCw, Users, Building2, Search, Package, LayoutGrid, ClipboardCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { PermissionsMasterDetail } from '@/components/admin/PermissionsMasterDetail';
import AdminShadowReview from '@/pages/admin/AdminShadowReview';
import AdminInertLinksReview from '@/pages/admin/AdminInertLinksReview';
import AdminUsers from '@/pages/admin/AdminUsers';

interface Module {
  id: string;
  name: string;
  route: string | null;
  icon: string | null;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface DeptModule {
  id: string;
  department_id: string;
  module_id: string;
  department_name?: string;
  module_name?: string;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  contact_email: string | null;
  position: string | null;
}

interface UserPermission {
  id: string;
  user_id: string;
  module_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  user_name?: string;
  module_name?: string;
}

// Legacy tab values → new location
const TAB_ALIASES: Record<string, { tab: string; sub?: string }> = {
  'user-perms': { tab: 'manage' },
  'overview': { tab: 'auditoria', sub: 'visao-geral' },
  'revisao-permissoes': { tab: 'auditoria', sub: 'revisao-permissoes' },
  'revisao-vinculos': { tab: 'auditoria', sub: 'revisao-vinculos' },
};

export default function AdminPermissions() {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') || 'usuarios';
  const rawSub = searchParams.get('sub') || '';

  // Resolve legacy aliases
  const alias = TAB_ALIASES[rawTab];
  const currentTab = alias ? alias.tab : rawTab;
  const currentSub = alias?.sub || rawSub || 'revisao-permissoes';

  useEffect(() => {
    if (alias) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', alias.tab);
      if (alias.sub) next.set('sub', alias.sub);
      else next.delete('sub');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTab]);

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'usuarios') next.delete('tab');
    else next.set('tab', value);
    next.delete('sub');
    setSearchParams(next, { replace: true });
  };

  const handleSubChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'auditoria');
    next.set('sub', value);
    setSearchParams(next, { replace: true });
  };

  const [modules, setModules] = useState<Module[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptModules, setDeptModules] = useState<DeptModule[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Department-Modules tab state
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [addModuleDialogOpen, setAddModuleDialogOpen] = useState(false);
  const [selectedModuleToAdd, setSelectedModuleToAdd] = useState<string>('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    const [modulesRes, deptsRes, deptModsRes, usersRes, permsRes] = await Promise.all([
      supabase.from('modules').select('id, name, route, icon, is_active').eq('is_active', true).order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('department_modules').select('id, department_id, module_id'),
      supabase.from('profiles').select('user_id, full_name, email, contact_email, position').eq('status', 'active').order('full_name'),
      supabase.from('permissions').select('id, user_id, module_id, can_view, can_create, can_edit, can_delete, can_approve').not('module_id', 'is', null),
    ]);

    setModules(modulesRes.data || []);
    setDepartments(deptsRes.data || []);
    setDeptModules(deptModsRes.data || []);
    setUsers(usersRes.data || []);
    setPermissions(permsRes.data || []);
    setIsLoading(false);
  };

  // ==================== Department Modules Tab ====================

  const deptLinkedModules = deptModules
    .filter(dm => dm.department_id === selectedDept)
    .map(dm => {
      const mod = modules.find(m => m.id === dm.module_id);
      return { ...dm, module_name: mod?.name || 'Desconhecido' };
    });

  const availableModulesToAdd = modules.filter(
    m => !deptLinkedModules.some(dm => dm.module_id === m.id)
  );

  const handleAddModuleToDept = async () => {
    if (!selectedDept || !selectedModuleToAdd) return;
    const { error } = await supabase.from('department_modules').insert({
      department_id: selectedDept,
      module_id: selectedModuleToAdd,
    });
    if (error) {
      toast.error('Erro ao vincular módulo');
      return;
    }
    toast.success('Módulo vinculado ao departamento');
    setAddModuleDialogOpen(false);
    setSelectedModuleToAdd('');
    fetchAllData();
  };

  const handleRemoveModuleFromDept = async (dmId: string) => {
    const { error } = await supabase.from('department_modules').delete().eq('id', dmId);
    if (error) {
      toast.error('Erro ao desvincular módulo');
      return;
    }
    toast.success('Módulo desvinculado');
    fetchAllData();
  };

  // ==================== Overview (sub-tab) ====================

  const usersWithPermissions = (() => {
    const userIds = [...new Set(permissions.map(p => p.user_id))];
    return userIds
      .map(uid => {
        const user = users.find(u => u.user_id === uid);
        const userPerms = permissions
          .filter(p => p.user_id === uid)
          .map(p => ({
            ...p,
            module_name: modules.find(m => m.id === p.module_id)?.name || 'Desconhecido',
          }));
        return { user, perms: userPerms };
      })
      .filter(u => u.user && u.perms.length > 0)
      .sort((a, b) => (a.user!.full_name).localeCompare(b.user!.full_name));
  })();

  const [overviewSearch, setOverviewSearch] = useState('');
  const filteredOverview = usersWithPermissions.filter(u =>
    u.user!.full_name.toLowerCase().includes(overviewSearch.toLowerCase()) ||
    (u.user!.contact_email || u.user!.email).toLowerCase().includes(overviewSearch.toLowerCase())
  );

  if (role !== 'adm_master') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas ADM Master pode gerenciar permissões.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Gerenciamento de Usuários e Permissões
          </h1>
          <p className="text-muted-foreground">
            Gerencie usuários, módulos por departamento e permissões
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAllData} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Permissões por Usuário
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="dept-modules" className="gap-2">
            <Building2 className="h-4 w-4" />
            Módulos por Departamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <AdminUsers />
        </TabsContent>

        <TabsContent value="manage">
          <PermissionsMasterDetail />
        </TabsContent>

        {/* ===== Tab: Auditoria (nested sub-tabs) ===== */}
        <TabsContent value="auditoria">
          <Tabs value={currentSub} onValueChange={handleSubChange} className="space-y-4">
            <TabsList>
              <TabsTrigger value="revisao-permissoes">Revisão de Permissões</TabsTrigger>
              <TabsTrigger value="revisao-vinculos">Revisão de Vínculos</TabsTrigger>
              <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            </TabsList>

            <TabsContent value="revisao-permissoes">
              <AdminShadowReview />
            </TabsContent>

            <TabsContent value="revisao-vinculos">
              <AdminInertLinksReview />
            </TabsContent>

            <TabsContent value="visao-geral">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Usuários com Permissões Liberadas</CardTitle>
                    <Badge variant="outline" className="text-sm">
                      {usersWithPermissions.length} usuário(s)
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar por nome ou e-mail..."
                      value={overviewSearch}
                      onChange={e => setOverviewSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {filteredOverview.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhum usuário com permissões encontrado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredOverview.map(({ user, perms }) => (
                        <div key={user!.user_id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{user!.full_name}</p>
                              <p className="text-sm text-muted-foreground">{user!.contact_email || user!.email}</p>
                            </div>
                            {user!.position && <Badge variant="outline">{user!.position}</Badge>}
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Módulo</TableHead>
                                <TableHead className="text-center">Visualizar</TableHead>
                                <TableHead className="text-center">Criar</TableHead>
                                <TableHead className="text-center">Editar</TableHead>
                                <TableHead className="text-center">Excluir</TableHead>
                                <TableHead className="text-center">Aprovar</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {perms.map(p => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium">{p.module_name}</TableCell>
                                  <TableCell className="text-center"><PermBadge value={p.can_view} /></TableCell>
                                  <TableCell className="text-center"><PermBadge value={p.can_create} /></TableCell>
                                  <TableCell className="text-center"><PermBadge value={p.can_edit} /></TableCell>
                                  <TableCell className="text-center"><PermBadge value={p.can_delete} /></TableCell>
                                  <TableCell className="text-center"><PermBadge value={p.can_approve} /></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ===== Tab: Department Modules ===== */}
        <TabsContent value="dept-modules">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vincular Módulos aos Departamentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label>Departamento</Label>
                  <Select value={selectedDept} onValueChange={setSelectedDept}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedDept && (
                  <Button onClick={() => setAddModuleDialogOpen(true)} disabled={availableModulesToAdd.length === 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    Vincular Módulo
                  </Button>
                )}
              </div>

              {selectedDept && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deptLinkedModules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                          Nenhum módulo vinculado a este departamento
                        </TableCell>
                      </TableRow>
                    ) : (
                      deptLinkedModules.map(dm => (
                        <TableRow key={dm.id}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {dm.module_name}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveModuleFromDept(dm.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Dialog: Add Module to Department ===== */}
      <Dialog open={addModuleDialogOpen} onOpenChange={setAddModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Módulo</DialogTitle>
            <DialogDescription>
              Selecione o módulo para vincular ao departamento{' '}
              <strong>{departments.find(d => d.id === selectedDept)?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedModuleToAdd} onValueChange={setSelectedModuleToAdd}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um módulo" />
              </SelectTrigger>
              <SelectContent>
                {availableModulesToAdd.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddModuleDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddModuleToDept} disabled={!selectedModuleToAdd}>Vincular</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermBadge({ value }: { value: boolean }) {
  return (
    <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
      {value ? '✓' : '✗'}
    </Badge>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
