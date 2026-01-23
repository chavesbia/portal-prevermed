import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Search, 
  UserPlus, 
  Shield, 
  Building2,
  Edit,
  Trash2,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

type HierarchyPosition = 'director' | 'manager' | 'coordinator' | 'leader' | 'team_member';

interface UserWithDetails {
  id: string;
  user_id: string;
  full_name: string;
  nickname: string | null;
  email: string;
  profile_photo_url: string | null;
  position: string | null;
  status: 'active' | 'inactive' | null;
  unit: 'lapa' | 'osasco' | null;
  hierarchy_position: HierarchyPosition | null;
  birth_date: string | null;
  start_date: string | null;
  internal_handle: string | null;
  created_at: string;
  role?: string;
  departments?: { id: string; name: string; is_primary: boolean }[];
}

interface Department {
  id: string;
  name: string;
}

export default function AdminUsers() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  
  // New user form states
  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    position: '',
    unit: 'lapa' as 'lapa' | 'osasco',
    hierarchy_position: 'team_member' as HierarchyPosition,
    internal_handle: '',
    role: '' as string,
    departments: [] as string[],
    primary_department: '' as string,
  });
  
  // Edit form states
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    position: '',
    status: 'active' as 'active' | 'inactive',
    unit: 'lapa' as 'lapa' | 'osasco',
    hierarchy_position: 'team_member' as HierarchyPosition,
    birth_date: '',
    start_date: '',
    internal_handle: '',
  });
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [primaryDepartment, setPrimaryDepartment] = useState<string>('');

  const isAdmMaster = role === 'adm_master';

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch user departments
      const { data: userDepts, error: deptsError } = await supabase
        .from('user_departments')
        .select('user_id, department_id, is_primary, departments(id, name)');

      if (deptsError) throw deptsError;

      // Combine data
      const usersWithDetails: UserWithDetails[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        const userDepartments = userDepts
          ?.filter(d => d.user_id === profile.user_id)
          .map(d => ({
            id: (d.departments as any)?.id || '',
            name: (d.departments as any)?.name || '',
            is_primary: d.is_primary || false,
          }));

        return {
          ...profile,
          role: userRole?.role,
          departments: userDepartments || [],
        };
      });

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching departments:', error);
      return;
    }

    setDepartments(data || []);
  };

  const handleEditUser = (user: UserWithDetails) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      position: user.position || '',
      status: user.status || 'active',
      unit: user.unit || 'lapa',
      hierarchy_position: user.hierarchy_position || 'team_member',
      birth_date: user.birth_date || '',
      start_date: user.start_date || '',
      internal_handle: user.internal_handle || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          position: editForm.position,
          status: editForm.status,
          unit: editForm.unit,
          hierarchy_position: editForm.hierarchy_position,
          birth_date: editForm.birth_date || null,
          start_date: editForm.start_date || null,
          internal_handle: editForm.internal_handle || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('Usuário atualizado com sucesso');
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário');
    }
  };

  const handleManageRole = (user: UserWithDetails) => {
    setSelectedUser(user);
    setSelectedRole(user.role || '');
    setIsRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser || !selectedRole) return;

    try {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', selectedUser.user_id)
        .maybeSingle();

      if (existingRole) {
      // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: selectedRole as 'adm_master' | 'adm_user' | 'tech_user' })
          .eq('user_id', selectedUser.user_id);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: selectedUser.user_id, role: selectedRole as any });

        if (error) throw error;
      }

      toast.success('Perfil de acesso atualizado');
      setIsRoleDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erro ao atualizar perfil de acesso');
    }
  };

  const handleManageDepartments = (user: UserWithDetails) => {
    setSelectedUser(user);
    setSelectedDepartments(user.departments?.map(d => d.id) || []);
    setPrimaryDepartment(user.departments?.find(d => d.is_primary)?.id || '');
    setIsDeptDialogOpen(true);
  };

  const handleSaveDepartments = async () => {
    if (!selectedUser) return;

    try {
      // Remove all existing departments
      await supabase
        .from('user_departments')
        .delete()
        .eq('user_id', selectedUser.user_id);

      // Insert new departments
      if (selectedDepartments.length > 0) {
        const deptInserts = selectedDepartments.map(deptId => ({
          user_id: selectedUser.user_id,
          department_id: deptId,
          is_primary: deptId === primaryDepartment,
        }));

        const { error } = await supabase
          .from('user_departments')
          .insert(deptInserts);

        if (error) throw error;
      }

      toast.success('Departamentos atualizados');
      setIsDeptDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating departments:', error);
      toast.error('Erro ao atualizar departamentos');
    }
  };

  const handleDeleteUser = async (user: UserWithDetails) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${user.full_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Usuário excluído com sucesso');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário');
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.full_name || !newUserForm.email) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }

    try {
      // Create user via Supabase Auth (this will trigger the handle_new_user function)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: Math.random().toString(36).slice(-12) + 'A1!', // Temporary password
        options: {
          data: {
            full_name: newUserForm.full_name,
          },
        },
      });

      if (authError) throw authError;

      // Update the profile with additional info
      if (authData.user) {
        // Wait a moment for the trigger to create the profile
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            position: newUserForm.position || null,
            unit: newUserForm.unit,
            hierarchy_position: newUserForm.hierarchy_position,
            internal_handle: newUserForm.internal_handle || null,
          })
          .eq('user_id', authData.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        }

        // Add role if selected
        if (newUserForm.role) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: authData.user.id,
              role: newUserForm.role as 'adm_master' | 'adm_user' | 'tech_user',
            });

          if (roleError) {
            console.error('Error adding role:', roleError);
          }
        }

        // Add departments if selected
        if (newUserForm.departments.length > 0) {
          const deptInserts = newUserForm.departments.map(deptId => ({
            user_id: authData.user!.id,
            department_id: deptId,
            is_primary: deptId === newUserForm.primary_department,
          }));

          const { error: deptError } = await supabase
            .from('user_departments')
            .insert(deptInserts);

          if (deptError) {
            console.error('Error adding departments:', deptError);
          }
        }
      }

      toast.success('Usuário criado com sucesso! Um e-mail de confirmação foi enviado.');
      setIsNewUserDialogOpen(false);
      setNewUserForm({
        full_name: '',
        email: '',
        position: '',
        unit: 'lapa',
        hierarchy_position: 'team_member',
        internal_handle: '',
        role: '',
        departments: [],
        primary_department: '',
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Erro ao criar usuário');
    }
  };

  const toggleNewUserDepartment = (deptId: string) => {
    setNewUserForm(prev => ({
      ...prev,
      departments: prev.departments.includes(deptId)
        ? prev.departments.filter(id => id !== deptId)
        : [...prev.departments, deptId],
    }));
  };

  const toggleDepartment = (deptId: string) => {
    setSelectedDepartments(prev => 
      prev.includes(deptId) 
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'adm_master':
        return <Badge className="bg-destructive">ADM Master</Badge>;
      case 'adm_user':
        return <Badge className="bg-primary">Administrativo</Badge>;
      case 'tech_user':
        return <Badge variant="secondary">Técnico</Badge>;
      default:
        return <Badge variant="outline">Sem perfil</Badge>;
    }
  };

  const getStatusBadge = (status?: 'active' | 'inactive' | null) => {
    return status === 'active' 
      ? <Badge className="bg-success">Ativo</Badge>
      : <Badge variant="destructive">Inativo</Badge>;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  if (!isAdmMaster) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas ADM Master pode gerenciar usuários.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Users className="h-6 w-6" />
          Gerenciar Usuários
        </h1>
        <p className="page-subtitle">
          Visualize e gerencie todos os usuários do sistema.
        </p>
      </div>

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Usuários ({filteredUsers.length})</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setIsNewUserDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Departamentos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.profile_photo_url || undefined} />
                          <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.position || '-'}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.departments?.length ? (
                          user.departments.map(dept => (
                            <Badge 
                              key={dept.id} 
                              variant={dept.is_primary ? "default" : "outline"}
                              className="text-xs"
                            >
                              {dept.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.unit || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageRole(user)}>
                            <Shield className="h-4 w-4 mr-2" />
                            Perfil de Acesso
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageDepartments(user)}>
                            <Building2 className="h-4 w-4 mr-2" />
                            Departamentos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteUser(user)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>@ Interno (para menções)</Label>
              <Input
                value={editForm.internal_handle}
                onChange={(e) => setEditForm(prev => ({ ...prev, internal_handle: e.target.value }))}
                placeholder="@usuario"
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={editForm.position}
                onChange={(e) => setEditForm(prev => ({ ...prev, position: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={editForm.birth_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, birth_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Admissão</Label>
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value: 'active' | 'inactive') => 
                    setEditForm(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select
                  value={editForm.unit}
                  onValueChange={(value: 'lapa' | 'osasco') => 
                    setEditForm(prev => ({ ...prev, unit: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lapa">Lapa</SelectItem>
                    <SelectItem value="osasco">Osasco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Posição Hierárquica</Label>
              <Select
                value={editForm.hierarchy_position}
                onValueChange={(value: HierarchyPosition) => 
                  setEditForm(prev => ({ ...prev, hierarchy_position: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Diretor</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="coordinator">Coordenador</SelectItem>
                  <SelectItem value="leader">Líder</SelectItem>
                  <SelectItem value="team_member">Membro da Equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveUser}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Management Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perfil de Acesso</DialogTitle>
            <DialogDescription>
              Defina o perfil de acesso do usuário {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adm_master">ADM Master</SelectItem>
                  <SelectItem value="adm_user">Usuário Administrativo</SelectItem>
                  <SelectItem value="tech_user">Usuário Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveRole}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Department Management Dialog */}
      <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Departamentos</DialogTitle>
            <DialogDescription>
              Defina os departamentos do usuário {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Selecione os departamentos</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-auto">
                {departments.map(dept => (
                  <div key={dept.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={dept.id}
                      checked={selectedDepartments.includes(dept.id)}
                      onChange={() => toggleDepartment(dept.id)}
                      className="rounded"
                    />
                    <label htmlFor={dept.id} className="flex-1 cursor-pointer">
                      {dept.name}
                    </label>
                    {selectedDepartments.includes(dept.id) && (
                      <Button
                        variant={primaryDepartment === dept.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPrimaryDepartment(dept.id)}
                      >
                        {primaryDepartment === dept.id ? 'Principal' : 'Definir Principal'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDeptDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveDepartments}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Cadastre um novo usuário no sistema. Um e-mail de confirmação será enviado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={newUserForm.full_name}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nome completo do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@prevermed.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label>@ Interno (para menções)</Label>
              <Input
                value={newUserForm.internal_handle}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, internal_handle: e.target.value }))}
                placeholder="@usuario"
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={newUserForm.position}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, position: e.target.value }))}
                placeholder="Ex: Analista, Coordenador..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select
                  value={newUserForm.unit}
                  onValueChange={(value: 'lapa' | 'osasco') => 
                    setNewUserForm(prev => ({ ...prev, unit: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lapa">Lapa</SelectItem>
                    <SelectItem value="osasco">Osasco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Posição Hierárquica</Label>
                <Select
                  value={newUserForm.hierarchy_position}
                  onValueChange={(value: HierarchyPosition) => 
                    setNewUserForm(prev => ({ ...prev, hierarchy_position: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="director">Diretor</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="coordinator">Coordenador</SelectItem>
                    <SelectItem value="leader">Líder</SelectItem>
                    <SelectItem value="team_member">Membro da Equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Perfil de Acesso */}
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(value) => setNewUserForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adm_master">ADM Master</SelectItem>
                  <SelectItem value="adm_user">Usuário Administrativo</SelectItem>
                  <SelectItem value="tech_user">Usuário Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Departamentos */}
            <div className="space-y-2">
              <Label>Departamentos</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-auto">
                {departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum departamento cadastrado</p>
                ) : (
                  departments.map(dept => (
                    <div key={dept.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`new-${dept.id}`}
                        checked={newUserForm.departments.includes(dept.id)}
                        onChange={() => toggleNewUserDepartment(dept.id)}
                        className="rounded"
                      />
                      <label htmlFor={`new-${dept.id}`} className="flex-1 cursor-pointer text-sm">
                        {dept.name}
                      </label>
                      {newUserForm.departments.includes(dept.id) && (
                        <Button
                          type="button"
                          variant={newUserForm.primary_department === dept.id ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setNewUserForm(prev => ({ ...prev, primary_department: dept.id }))}
                        >
                          {newUserForm.primary_department === dept.id ? 'Principal' : 'Definir'}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsNewUserDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser}>
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Usuário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
