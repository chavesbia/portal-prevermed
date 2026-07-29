import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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
  RefreshCw,
  Calendar,
  AtSign,
  Briefcase,
  MapPin,
  User,
  KeyRound,
  FileSpreadsheet,
  Phone,
  Camera
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
import BulkImportDialog from '@/components/admin/BulkImportDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAccessPanel } from '@/components/admin/UserAccessPanel';

type HierarchyPosition = 'director' | 'manager' | 'coordinator' | 'leader' | 'team_member';

interface UserWithDetails {
  id: string;
  user_id: string;
  full_name: string;
  nickname: string | null;
  email: string;
  login: string | null;
  profile_photo_url: string | null;
  position: string | null;
  status: 'active' | 'inactive' | null;
  unit: 'lapa' | 'osasco' | null;
  hierarchy_position: HierarchyPosition | null;
  birth_date: string | null;
  start_date: string | null;
  internal_handle: string | null;
  contact_email: string | null;
  phone_extension: string | null;
  direct_leader_id: string | null;
  direct_manager_id: string | null;
  created_at: string;
  role?: string;
  departments?: { id: string; name: string; is_lotacao: boolean }[];
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
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // New user form states
  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    nickname: '',
    login: '',
    position: '',
    unit: 'lapa' as 'lapa' | 'osasco',
    hierarchy_position: 'team_member' as HierarchyPosition,
    internal_handle: '',
    role: '' as string,
    departments: [] as string[],
    primary_department: '' as string,
    birth_date: '',
    start_date: '',
    phone_extension: '',
    contact_email: '',
    direct_leader_id: '',
    direct_manager_id: '',
  });
  const [newUserPhotoFile, setNewUserPhotoFile] = useState<File | null>(null);
  const [newUserPhotoPreview, setNewUserPhotoPreview] = useState<string | null>(null);
  const newUserPhotoInputRef = useRef<HTMLInputElement>(null);
  
  // Unified edit form states (includes profile, role, and departments)
  const [editForm, setEditForm] = useState({
    full_name: '',
    login: '',
    nickname: '',
    position: '',
    status: 'active' as 'active' | 'inactive',
    unit: 'lapa' as 'lapa' | 'osasco',
    hierarchy_position: 'team_member' as HierarchyPosition,
    birth_date: '',
    start_date: '',
    internal_handle: '',
    role: '' as string,
    departments: [] as string[],
    primary_department: '' as string,
    phone_extension: '',
    contact_email: '',
    direct_leader_id: '',
    direct_manager_id: '',
  });

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
        .select('user_id, department_id, is_lotacao, departments(id, name)');

      if (deptsError) throw deptsError;

      // Combine data
      const usersWithDetails: UserWithDetails[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        const userDepartments = userDepts
          ?.filter(d => d.user_id === profile.user_id)
          .map(d => ({
            id: (d.departments as any)?.id || '',
            name: (d.departments as any)?.name || '',
            is_lotacao: d.is_lotacao || false,
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
      login: user.login || '',
      nickname: user.nickname || '',
      position: user.position || '',
      status: user.status || 'active',
      unit: user.unit || 'lapa',
      hierarchy_position: user.hierarchy_position || 'team_member',
      birth_date: user.birth_date || '',
      start_date: user.start_date || '',
      internal_handle: user.internal_handle || '',
      role: user.role || '',
      departments: user.departments?.map(d => d.id) || [],
      primary_department: user.departments?.find(d => d.is_lotacao)?.id || '',
      phone_extension: user.phone_extension || '',
      contact_email: user.contact_email || '',
      direct_leader_id: user.direct_leader_id || '',
      direct_manager_id: user.direct_manager_id || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    setIsSaving(true);

    try {
      // 1. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          login: editForm.login || null,
          nickname: editForm.nickname || null,
          position: editForm.position || null,
          status: editForm.status,
          unit: editForm.unit,
          hierarchy_position: editForm.hierarchy_position,
          birth_date: editForm.birth_date || null,
          start_date: editForm.start_date || null,
          internal_handle: editForm.internal_handle || null,
          phone_extension: editForm.phone_extension || null,
          contact_email: editForm.contact_email || null,
          direct_leader_id: editForm.direct_leader_id || null,
          direct_manager_id: editForm.direct_manager_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

      // 2. Update role
      if (editForm.role) {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', selectedUser.user_id)
          .maybeSingle();

        if (existingRole) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role: editForm.role as 'adm_master' | 'adm_user' | 'tech_user' })
            .eq('user_id', selectedUser.user_id);

          if (roleError) {
            console.error('Error updating role:', roleError);
            toast.error('Erro ao atualizar perfil de acesso');
          }
        } else {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: selectedUser.user_id, role: editForm.role as any });

          if (roleError) {
            console.error('Error inserting role:', roleError);
            toast.error('Erro ao adicionar perfil de acesso');
          }
        }
      } else {
        // Remove role if cleared
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.user_id);
      }

      // 3. Update departments
      // First, remove all existing departments
      await supabase
        .from('user_departments')
        .delete()
        .eq('user_id', selectedUser.user_id);

      // Then, insert new departments
      if (editForm.departments.length > 0) {
        const deptInserts = editForm.departments.map(deptId => ({
          user_id: selectedUser.user_id,
          department_id: deptId,
          is_lotacao: deptId === editForm.primary_department,
        }));

        const { error: deptError } = await supabase
          .from('user_departments')
          .insert(deptInserts);

        if (deptError) {
          console.error('Error updating departments:', deptError);
          toast.error('Erro ao atualizar departamentos');
        }
      }

      toast.success('Usuário atualizado com sucesso!');
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setIsSaving(false);
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

  const handleResetPassword = async (user: UserWithDetails) => {
    if (!confirm(`Resetar a senha de ${user.full_name} para "prevermed"?\n\nO usuário deverá alterar a senha no próximo acesso.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { targetUserId: user.user_id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Senha de ${user.full_name} resetada para "prevermed"`);
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Erro ao resetar senha');
    }
  };

  const handleToggleStatus = async (user: UserWithDetails) => {
    const nextStatus: 'active' | 'inactive' = user.status === 'active' ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'inactive' ? 'inativar' : 'ativar';
    if (!confirm(`Tem certeza que deseja ${actionLabel} o usuário ${user.full_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(`Usuário ${nextStatus === 'inactive' ? 'inativado' : 'ativado'} com sucesso`);
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Erro ao alterar status do usuário');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedUser.user_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      setSelectedUser(prev => prev ? { ...prev, profile_photo_url: publicUrl } : null);
      toast.success('Foto atualizada!');
      fetchUsers();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Erro ao enviar foto: ' + (error?.message || 'desconhecido'));
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.full_name || !newUserForm.login) {
      toast.error('Nome e login são obrigatórios');
      return;
    }

    const loginFormatted = newUserForm.login.trim().toLowerCase().replace(/\s+/g, '.');
    
    const { data: existingLogin } = await supabase
      .from('profiles')
      .select('id')
      .eq('login', loginFormatted)
      .maybeSingle();
      
    if (existingLogin) {
      toast.error('Este login já está em uso');
      return;
    }

    setIsSaving(true);

    try {
      // Use edge function to create user without switching session
      const { data, error } = await supabase.functions.invoke('bulk-create-users', {
        body: {
          users: [{
            full_name: newUserForm.full_name,
            nickname: newUserForm.nickname || undefined,
            login: loginFormatted,
            position: newUserForm.position || undefined,
            unit: newUserForm.unit,
            hierarchy_position: newUserForm.hierarchy_position,
            internal_handle: newUserForm.internal_handle || loginFormatted,
            birth_date: newUserForm.birth_date || undefined,
            start_date: newUserForm.start_date || undefined,
            phone_extension: newUserForm.phone_extension || undefined,
            contact_email: newUserForm.contact_email || undefined,
            role: newUserForm.role || undefined,
            departments: newUserForm.departments.length > 0 
              ? newUserForm.departments.map(deptId => {
                  const dept = departments.find(d => d.id === deptId);
                  return dept?.name || '';
                }).filter(Boolean)
              : undefined,
            primary_department: newUserForm.primary_department 
              ? departments.find(d => d.id === newUserForm.primary_department)?.name 
              : undefined,
          }],
        },
      });

      if (error) throw error;

      const createdUserId = data?.results?.[0]?.success ? data.results[0].user_id : null;

      // After user is created, update direct_leader_id and direct_manager_id
      if (createdUserId && (newUserForm.direct_leader_id || newUserForm.direct_manager_id)) {
        await supabase
          .from('profiles')
          .update({
            direct_leader_id: newUserForm.direct_leader_id || null,
            direct_manager_id: newUserForm.direct_manager_id || null,
          })
          .eq('user_id', createdUserId);
      }

      // Upload photo if provided
      if (createdUserId && newUserPhotoFile) {
        try {
          const fileExt = newUserPhotoFile.name.split('.').pop();
          const fileName = `${createdUserId}/${Date.now()}.${fileExt}`;
          const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, newUserPhotoFile, { upsert: true });
          if (upErr) throw upErr;
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
          await supabase
            .from('profiles')
            .update({ profile_photo_url: publicUrl, updated_at: new Date().toISOString() })
            .eq('user_id', createdUserId);
        } catch (photoErr) {
          console.error('Erro ao enviar foto do novo usuário:', photoErr);
          toast.error('Usuário criado, mas falhou ao enviar foto');
        }
      }

      if (data?.results?.[0]?.success) {
        toast.success(`Usuário criado! Login: ${loginFormatted} | Senha: prevermed`);
      } else {
        toast.error(data?.results?.[0]?.error || 'Erro ao criar usuário');
      }

      setIsNewUserDialogOpen(false);
      setNewUserForm({
        full_name: '',
        nickname: '',
        login: '',
        position: '',
        unit: 'lapa',
        hierarchy_position: 'team_member',
        internal_handle: '',
        role: '',
        departments: [],
        primary_department: '',
        birth_date: '',
        start_date: '',
        phone_extension: '',
        contact_email: '',
        direct_leader_id: '',
        direct_manager_id: '',
      });
      setNewUserPhotoFile(null);
      setNewUserPhotoPreview(null);
      if (newUserPhotoInputRef.current) newUserPhotoInputRef.current.value = '';
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setIsSaving(false);
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

  const toggleEditDepartment = (deptId: string) => {
    setEditForm(prev => ({
      ...prev,
      departments: prev.departments.includes(deptId)
        ? prev.departments.filter(id => id !== deptId)
        : [...prev.departments, deptId],
    }));
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

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="icon" onClick={fetchUsers}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Importar
        </Button>
        <Button onClick={() => setIsNewUserDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card flex h-[calc(100vh-20rem)] min-h-[600px]">
        {/* Master column */}
        <aside className="w-80 border-r border-border flex flex-col bg-muted/30">
          <div className="p-4 border-b border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Usuários
              </h2>
              <Badge variant="secondary" className="text-[10px]">{filteredUsers.length}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </div>
            ) : (
              <ul>
                {filteredUsers.map((user) => {
                  const active = user.user_id === detailUserId;
                  return (
                    <li key={user.id}>
                      <button
                        onClick={() => setDetailUserId(user.user_id)}
                        className={cn(
                          'w-full text-left p-3 border-b border-border transition-colors',
                          active
                            ? 'bg-card border-l-4 border-l-primary'
                            : 'hover:bg-muted border-l-4 border-l-transparent'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={user.profile_photo_url || undefined} />
                            <AvatarFallback className="text-[10px]">{getInitials(user.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.position || 'Sem cargo'}</p>
                          </div>
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase shrink-0 px-1.5 py-0.5 rounded border',
                              user.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-muted text-muted-foreground border-border'
                            )}
                          >
                            {user.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
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
          {!detailUser ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Users className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">Selecione um usuário</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Escolha um usuário na lista à esquerda para visualizar e gerenciar seus dados.
              </p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-border flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={detailUser.profile_photo_url || undefined} />
                    <AvatarFallback>{getInitials(detailUser.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{detailUser.full_name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {detailUser.contact_email || detailUser.email}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {getRoleBadge(detailUser.role)}
                      {getStatusBadge(detailUser.status)}
                      <Badge variant="outline" className="capitalize">{detailUser.unit || '-'}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleEditUser(detailUser)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleResetPassword(detailUser)}>
                        <KeyRound className="h-4 w-4 mr-2" />
                        Resetar Senha
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(detailUser)}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {detailUser.status === 'active' ? 'Inativar Usuário' : 'Ativar Usuário'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteUser(detailUser)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-5 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailField icon={Briefcase} label="Cargo" value={detailUser.position} />
                    <DetailField icon={User} label="Apelido" value={detailUser.nickname} />
                    <DetailField icon={AtSign} label="Login" value={detailUser.login} />
                    <DetailField icon={AtSign} label="Handle interno" value={detailUser.internal_handle} />
                    <DetailField icon={Phone} label="Ramal" value={detailUser.phone_extension} />
                    <DetailField icon={MapPin} label="Unidade" value={detailUser.unit} />
                    <DetailField
                      icon={Calendar}
                      label="Nascimento"
                      value={formatDateBR(detailUser.birth_date)}
                    />
                    <DetailField
                      icon={Calendar}
                      label="Admissão"
                      value={formatDateBR(detailUser.start_date)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      Departamentos
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailUser.departments?.length ? (
                        detailUser.departments.map(dept => (
                          <Badge
                            key={dept.id}
                            variant={dept.is_lotacao ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {dept.name}{dept.is_lotacao ? ' (lotação)' : ''}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhum departamento vinculado</span>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </main>
      </div>


      {/* Edit User Dialog - Unified with all fields */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>
              Atualize todas as informações do usuário {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* Photo Upload */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser?.profile_photo_url || undefined} />
                  <AvatarFallback className="text-lg">{selectedUser ? getInitials(selectedUser.full_name) : ''}</AvatarFallback>
                </Avatar>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                >
                  {isUploadingPhoto ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                </Button>
              </div>
              <div>
                <p className="font-medium">{selectedUser?.full_name}</p>
                <p className="text-sm text-muted-foreground">Clique no ícone para alterar a foto</p>
              </div>
            </div>

            {/* Section: Personal Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Informações Pessoais
              </div>
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apelido</Label>
                  <Input
                    value={editForm.nickname}
                    onChange={(e) => setEditForm(prev => ({ ...prev, nickname: e.target.value }))}
                    placeholder="Como prefere ser chamado"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <AtSign className="h-3 w-3" />
                    Login
                  </Label>
                  <Input
                    value={editForm.login}
                    onChange={(e) => setEditForm(prev => ({ ...prev, login: e.target.value.toLowerCase().replace(/\s+/g, '.') }))}
                    placeholder="nome.sobrenome"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail de Contato</Label>
                  <Input
                    type="email"
                    value={editForm.contact_email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, contact_email: e.target.value }))}
                    placeholder="email@prevermed.com.br"
                  />
                </div>
              </div>
            </div>

            {/* Section: Dates */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Datas
              </div>
              <Separator />
              
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
            </div>

            {/* Section: Position Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Cargo e Posição
              </div>
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input
                    value={editForm.position}
                    onChange={(e) => setEditForm(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="Ex: Analista, Coordenador..."
                  />
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
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Unidade
                  </Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Ramal
                  </Label>
                  <Input
                    value={editForm.phone_extension}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone_extension: e.target.value }))}
                    placeholder="Ex: 201"
                  />
                </div>
                <div className="space-y-2">
                  <Label>@ Interno (menções)</Label>
                  <Input
                    value={editForm.internal_handle}
                    onChange={(e) => setEditForm(prev => ({ ...prev, internal_handle: e.target.value }))}
                    placeholder="@usuario"
                  />
                </div>
              </div>

              {/* Direct Leader / Manager */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Líder Direto</Label>
                  <Select
                    value={editForm.direct_leader_id || '__none__'}
                    onValueChange={(value) => setEditForm(prev => ({ ...prev, direct_leader_id: value === '__none__' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {users
                        .filter(u => u.user_id !== selectedUser?.user_id && ['leader', 'coordinator', 'manager', 'director'].includes(u.hierarchy_position || ''))
                        .map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name} {u.position ? `— ${u.position}` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gestor Direto</Label>
                  <Select
                    value={editForm.direct_manager_id || '__none__'}
                    onValueChange={(value) => setEditForm(prev => ({ ...prev, direct_manager_id: value === '__none__' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {users
                        .filter(u => u.user_id !== selectedUser?.user_id && ['manager', 'director'].includes(u.hierarchy_position || ''))
                        .map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name} {u.position ? `— ${u.position}` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section: Access Profile */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4" />
                Perfil de Acesso
              </div>
              <Separator />
              
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select 
                  value={editForm.role} 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value }))}
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
                <p className="text-xs text-muted-foreground">
                  O perfil define as permissões de acesso do usuário no sistema.
                </p>
              </div>
            </div>

            {/* Section: Departments */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Departamentos
              </div>
              <Separator />
              
              <div className="space-y-2">
                <Label>Selecione os departamentos</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-auto">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`edit-dept-${dept.id}`}
                        checked={editForm.departments.includes(dept.id)}
                        onCheckedChange={() => toggleEditDepartment(dept.id)}
                      />
                      <label 
                        htmlFor={`edit-dept-${dept.id}`} 
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {dept.name}
                      </label>
                      {editForm.departments.includes(dept.id) && (
                        <Button
                          type="button"
                          variant={editForm.primary_department === dept.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEditForm(prev => ({ ...prev, primary_department: dept.id }))}
                        >
                          {editForm.primary_department === dept.id ? 'Principal' : 'Definir Principal'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  O departamento principal aparecerá em destaque no perfil do usuário.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo Usuário
            </DialogTitle>
            <DialogDescription>
              Cadastre um novo usuário no sistema. Login obrigatório, senha padrão: prevermed.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* Photo Upload */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={newUserPhotoPreview || undefined} />
                  <AvatarFallback className="text-lg">
                    {newUserForm.full_name ? getInitials(newUserForm.full_name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={newUserPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      toast.error('Por favor, selecione uma imagem');
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('A imagem deve ter no máximo 5MB');
                      return;
                    }
                    setNewUserPhotoFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setNewUserPhotoPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
                  onClick={() => newUserPhotoInputRef.current?.click()}
                  type="button"
                >
                  <Camera className="h-3 w-3" />
                </Button>
              </div>
              <div>
                <p className="text-sm font-medium">Foto do perfil</p>
                <p className="text-xs text-muted-foreground">Opcional. Será enviada após criar o usuário.</p>
              </div>
            </div>

            {/* Section: Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Informações Básicas
              </div>
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    value={newUserForm.full_name}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Nome completo do usuário"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apelido</Label>
                  <Input
                    value={newUserForm.nickname}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, nickname: e.target.value }))}
                    placeholder="Como prefere ser chamado"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Login *</Label>
                  <Input
                    value={newUserForm.login}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, login: e.target.value.toLowerCase().replace(/\s+/g, '.') }))}
                    placeholder="nome.sobrenome"
                  />
                  <p className="text-xs text-muted-foreground">
                    Senha padrão: prevermed
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input
                    value={newUserForm.position}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="Ex: Analista, Coordenador..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <AtSign className="h-3 w-3" />
                  Interno (menções)
                </Label>
                <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground flex items-center">
                  {newUserForm.login
                    ? `@${newUserForm.login.toLowerCase().replace(/[^a-z0-9._-]/g, '')}`
                    : 'Será gerado a partir do login'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gerado automaticamente a partir do login do usuário.
                </p>
              </div>
            </div>

            {/* Section: Dates */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Datas
              </div>
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={newUserForm.birth_date}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, birth_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Admissão</Label>
                  <Input
                    type="date"
                    value={newUserForm.start_date}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Section: Position */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Cargo e Localização
              </div>
              <Separator />
              
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Ramal
                  </Label>
                  <Input
                    value={newUserForm.phone_extension}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, phone_extension: e.target.value }))}
                    placeholder="Ex: 201"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail de Contato</Label>
                  <Input
                    type="email"
                    value={newUserForm.contact_email}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, contact_email: e.target.value }))}
                    placeholder="email@prevermed.com.br"
                  />
                </div>
              </div>

              {/* Direct Leader / Manager */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Líder Direto</Label>
                  <Select
                    value={newUserForm.direct_leader_id || '__none__'}
                    onValueChange={(value) => setNewUserForm(prev => ({ ...prev, direct_leader_id: value === '__none__' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {users
                        .filter(u => ['leader', 'coordinator', 'manager', 'director'].includes(u.hierarchy_position || ''))
                        .map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name} {u.position ? `— ${u.position}` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gestor Direto</Label>
                  <Select
                    value={newUserForm.direct_manager_id || '__none__'}
                    onValueChange={(value) => setNewUserForm(prev => ({ ...prev, direct_manager_id: value === '__none__' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {users
                        .filter(u => ['manager', 'director'].includes(u.hierarchy_position || ''))
                        .map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name} {u.position ? `— ${u.position}` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section: Access Profile */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4" />
                Perfil de Acesso
              </div>
              <Separator />
              
              <div className="space-y-2">
                <Label>Perfil</Label>
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
            </div>

            {/* Section: Departments */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Departamentos
              </div>
              <Separator />
              
              <div className="space-y-2">
                <Label>Selecione os departamentos</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-auto">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`new-dept-${dept.id}`}
                        checked={newUserForm.departments.includes(dept.id)}
                        onCheckedChange={() => toggleNewUserDepartment(dept.id)}
                      />
                      <label 
                        htmlFor={`new-dept-${dept.id}`} 
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {dept.name}
                      </label>
                      {newUserForm.departments.includes(dept.id) && (
                        <Button
                          type="button"
                          variant={newUserForm.primary_department === dept.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewUserForm(prev => ({ ...prev, primary_department: dept.id }))}
                        >
                          {newUserForm.primary_department === dept.id ? 'Principal' : 'Definir Principal'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setIsNewUserDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Usuário'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onComplete={fetchUsers}
      />
    </div>
  );
}
