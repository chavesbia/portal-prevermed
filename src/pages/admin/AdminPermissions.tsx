import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Shield, Plus, Edit, Trash2, RefreshCw, Users, Building2, Search, Package,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

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

const ACTIONS = [
  { key: 'can_view', label: 'Visualizar' },
  { key: 'can_create', label: 'Criar' },
  { key: 'can_edit', label: 'Editar' },
  { key: 'can_delete', label: 'Excluir' },
  { key: 'can_approve', label: 'Aprovar' },
] as const;

export default function AdminPermissions() {
  const { role } = useAuth();
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

  // User permissions tab state
  const [searchUser, setSearchUser] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingPerm, setEditingPerm] = useState<UserPermission | null>(null);
  const [permForm, setPermForm] = useState({
    module_id: '',
    can_view: true,
    can_create: false,
    can_edit: false,
    can_delete: false,
    can_approve: false,
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    const [modulesRes, deptsRes, deptModsRes, usersRes, permsRes] = await Promise.all([
      supabase.from('modules').select('id, name, route, icon, is_active').eq('is_active', true).order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('department_modules').select('id, department_id, module_id'),
      supabase.from('profiles').select('user_id, full_name, email, position').eq('status', 'active').order('full_name'),
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

  // ==================== User Permissions Tab ====================

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  // Get modules available to the selected user (based on their departments)
  const getUserAvailableModules = (userId: string) => {
    // Get user's department IDs (we need to fetch from user_departments)
    // For simplicity, show all department-linked modules
    const allLinkedModuleIds = new Set(deptModules.map(dm => dm.module_id));
    return modules.filter(m => allLinkedModuleIds.has(m.id));
  };

  const userPermissions = permissions
    .filter(p => p.user_id === selectedUser)
    .map(p => ({
      ...p,
      module_name: modules.find(m => m.id === p.module_id)?.name || 'Desconhecido',
    }));

  const handleOpenPermDialog = (perm?: UserPermission) => {
    if (perm) {
      setEditingPerm(perm);
      setPermForm({
        module_id: perm.module_id,
        can_view: perm.can_view,
        can_create: perm.can_create,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete,
        can_approve: perm.can_approve,
      });
    } else {
      setEditingPerm(null);
      setPermForm({
        module_id: '',
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
        can_approve: false,
      });
    }
    setPermDialogOpen(true);
  };

  const handleSavePerm = async () => {
    if (!selectedUser || !permForm.module_id) return;

    if (editingPerm) {
      const { error } = await supabase
        .from('permissions')
        .update({
          can_view: permForm.can_view,
          can_create: permForm.can_create,
          can_edit: permForm.can_edit,
          can_delete: permForm.can_delete,
          can_approve: permForm.can_approve,
        })
        .eq('id', editingPerm.id);

      if (error) {
        toast.error('Erro ao atualizar permissão');
        return;
      }
      toast.success('Permissão atualizada');
    } else {
      // Check for existing
      const existing = permissions.find(
        p => p.user_id === selectedUser && p.module_id === permForm.module_id
      );
      if (existing) {
        toast.error('Este usuário já possui permissão para este módulo');
        return;
      }

      const { error } = await supabase.from('permissions').insert({
        user_id: selectedUser,
        module_id: permForm.module_id,
        can_view: permForm.can_view,
        can_create: permForm.can_create,
        can_edit: permForm.can_edit,
        can_delete: permForm.can_delete,
        can_approve: permForm.can_approve,
      });

      if (error) {
        toast.error('Erro ao criar permissão');
        return;
      }
      toast.success('Permissão criada');
    }

    setPermDialogOpen(false);
    fetchAllData();
  };

  const handleDeletePerm = async (permId: string) => {
    const { error } = await supabase.from('permissions').delete().eq('id', permId);
    if (error) {
      toast.error('Erro ao remover permissão');
      return;
    }
    toast.success('Permissão removida');
    fetchAllData();
  };

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
            Gerenciamento de Permissões
          </h1>
          <p className="text-muted-foreground">
            Gerencie módulos por departamento e permissões por usuário
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAllData} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="dept-modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dept-modules" className="gap-2">
            <Building2 className="h-4 w-4" />
            Módulos por Departamento
          </TabsTrigger>
          <TabsTrigger value="user-perms" className="gap-2">
            <Users className="h-4 w-4" />
            Permissões de Usuários
          </TabsTrigger>
        </TabsList>

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

        {/* ===== Tab: User Permissions ===== */}
        <TabsContent value="user-perms">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Permissões por Usuário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label>Buscar Usuário</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome ou e-mail..."
                      value={searchUser}
                      onChange={e => setSearchUser(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {searchUser && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {filteredUsers.slice(0, 20).map(u => (
                    <button
                      key={u.user_id}
                      className={cn(
                        'w-full text-left px-4 py-2 hover:bg-accent transition-colors flex justify-between items-center',
                        selectedUser === u.user_id && 'bg-accent'
                      )}
                      onClick={() => {
                        setSelectedUser(u.user_id);
                        setSearchUser(u.full_name);
                      }}
                    >
                      <div>
                        <div className="font-medium">{u.full_name}</div>
                        <div className="text-sm text-muted-foreground">{u.email}</div>
                      </div>
                      {u.position && <Badge variant="outline">{u.position}</Badge>}
                    </button>
                  ))}
                </div>
              )}

              {selectedUser && (
                <>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <h3 className="font-semibold">
                      Permissões de {users.find(u => u.user_id === selectedUser)?.full_name}
                    </h3>
                    <Button size="sm" onClick={() => handleOpenPermDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Permissão
                    </Button>
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
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userPermissions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhuma permissão configurada para este usuário
                          </TableCell>
                        </TableRow>
                      ) : (
                        userPermissions.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.module_name}</TableCell>
                            <TableCell className="text-center">
                              <PermBadge value={p.can_view} />
                            </TableCell>
                            <TableCell className="text-center">
                              <PermBadge value={p.can_create} />
                            </TableCell>
                            <TableCell className="text-center">
                              <PermBadge value={p.can_edit} />
                            </TableCell>
                            <TableCell className="text-center">
                              <PermBadge value={p.can_delete} />
                            </TableCell>
                            <TableCell className="text-center">
                              <PermBadge value={p.can_approve} />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenPermDialog(p)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeletePerm(p.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </>
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

      {/* ===== Dialog: User Permission ===== */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPerm ? 'Editar Permissão' : 'Nova Permissão'}</DialogTitle>
            <DialogDescription>
              Configure as permissões para{' '}
              <strong>{users.find(u => u.user_id === selectedUser)?.full_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Módulo</Label>
              <Select
                value={permForm.module_id}
                onValueChange={v => setPermForm(prev => ({ ...prev, module_id: v }))}
                disabled={!!editingPerm}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um módulo" />
                </SelectTrigger>
                <SelectContent>
                  {getUserAvailableModules(selectedUser).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Permissões</Label>
              {ACTIONS.map(action => (
                <div key={action.key} className="flex items-center gap-2">
                  <Checkbox
                    id={action.key}
                    checked={permForm[action.key as keyof typeof permForm] as boolean}
                    onCheckedChange={(checked) =>
                      setPermForm(prev => ({ ...prev, [action.key]: !!checked }))
                    }
                  />
                  <label htmlFor={action.key} className="text-sm cursor-pointer">
                    {action.label}
                  </label>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPermForm(prev => ({
                  ...prev,
                  can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true,
                }))}
              >
                Acesso Completo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPermForm(prev => ({
                  ...prev,
                  can_view: true, can_create: false, can_edit: false, can_delete: false, can_approve: false,
                }))}
              >
                Somente Leitura
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setPermDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSavePerm} disabled={!permForm.module_id}>Salvar</Button>
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
