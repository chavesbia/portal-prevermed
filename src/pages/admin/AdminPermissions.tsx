import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Search, 
  Plus, 
  Edit,
  Trash2,
  RefreshCw,
  Users,
  Building2,
  LayoutDashboard
} from 'lucide-react';
import { toast } from 'sonner';

interface Permission {
  id: string;
  user_id: string | null;
  department_id: string | null;
  module_id: string | null;
  dashboard_id: string | null;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  created_at: string;
  // Joined data
  user_name?: string;
  department_name?: string;
  module_name?: string;
  dashboard_name?: string;
}

interface User {
  id: string;
  user_id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Module {
  id: string;
  name: string;
}

interface Dashboard {
  id: string;
  name: string;
  module_id: string | null;
}

export default function AdminPermissions() {
  const { role } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  
  const [formData, setFormData] = useState({
    user_id: '',
    department_id: '',
    module_id: '',
    dashboard_id: '',
    can_view: true,
    can_create: false,
    can_edit: false,
    can_delete: false,
    can_approve: false,
  });

  const isAdmMaster = role === 'adm_master';

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [permsRes, usersRes, deptsRes, modulesRes, dashboardsRes] = await Promise.all([
        supabase.from('permissions').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, user_id, full_name').order('full_name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('modules').select('id, name').order('name'),
        supabase.from('dashboards').select('id, name, module_id').order('name'),
      ]);

      if (permsRes.error) throw permsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (deptsRes.error) throw deptsRes.error;
      if (modulesRes.error) throw modulesRes.error;
      if (dashboardsRes.error) throw dashboardsRes.error;

      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);
      setModules(modulesRes.data || []);
      setDashboards(dashboardsRes.data || []);

      // Map permission data with names
      const permsWithNames = (permsRes.data || []).map(perm => {
        const user = usersRes.data?.find(u => u.user_id === perm.user_id);
        const dept = deptsRes.data?.find(d => d.id === perm.department_id);
        const mod = modulesRes.data?.find(m => m.id === perm.module_id);
        const dash = dashboardsRes.data?.find(d => d.id === perm.dashboard_id);

        return {
          ...perm,
          user_name: user?.full_name,
          department_name: dept?.name,
          module_name: mod?.name,
          dashboard_name: dash?.name,
        };
      });

      setPermissions(permsWithNames);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (perm?: Permission) => {
    if (perm) {
      setEditingPerm(perm);
      setFormData({
        user_id: perm.user_id || '',
        department_id: perm.department_id || '',
        module_id: perm.module_id || '',
        dashboard_id: perm.dashboard_id || '',
        can_view: perm.can_view ?? true,
        can_create: perm.can_create ?? false,
        can_edit: perm.can_edit ?? false,
        can_delete: perm.can_delete ?? false,
        can_approve: perm.can_approve ?? false,
      });
    } else {
      setEditingPerm(null);
      setFormData({
        user_id: '',
        department_id: '',
        module_id: '',
        dashboard_id: '',
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
        can_approve: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.user_id && !formData.department_id) {
      toast.error('Selecione um usuário ou departamento');
      return;
    }

    if (!formData.module_id && !formData.dashboard_id) {
      toast.error('Selecione um módulo ou dashboard');
      return;
    }

    try {
      const permissionData = {
        user_id: formData.user_id || null,
        department_id: formData.department_id || null,
        module_id: formData.module_id || null,
        dashboard_id: formData.dashboard_id || null,
        can_view: formData.can_view,
        can_create: formData.can_create,
        can_edit: formData.can_edit,
        can_delete: formData.can_delete,
        can_approve: formData.can_approve,
      };

      if (editingPerm) {
        const { error } = await supabase
          .from('permissions')
          .update({
            ...permissionData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPerm.id);

        if (error) throw error;
        toast.success('Permissão atualizada');
      } else {
        const { error } = await supabase
          .from('permissions')
          .insert(permissionData);

        if (error) throw error;
        toast.success('Permissão criada');
      }

      setIsDialogOpen(false);
      fetchAllData();
    } catch (error) {
      console.error('Error saving permission:', error);
      toast.error('Erro ao salvar permissão');
    }
  };

  const handleDelete = async (perm: Permission) => {
    if (!confirm('Tem certeza que deseja excluir esta permissão?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('permissions')
        .delete()
        .eq('id', perm.id);

      if (error) throw error;

      toast.success('Permissão excluída');
      fetchAllData();
    } catch (error) {
      console.error('Error deleting permission:', error);
      toast.error('Erro ao excluir permissão');
    }
  };

  const getFilteredPermissions = () => {
    let filtered = permissions;

    if (activeTab === 'users') {
      filtered = permissions.filter(p => p.user_id);
    } else if (activeTab === 'departments') {
      filtered = permissions.filter(p => p.department_id);
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.module_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.dashboard_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredPermissions = getFilteredPermissions();

  const PermissionBadges = ({ perm }: { perm: Permission }) => (
    <div className="flex flex-wrap gap-1">
      {perm.can_view && <Badge variant="outline" className="text-xs">Ver</Badge>}
      {perm.can_create && <Badge variant="outline" className="text-xs bg-success/10">Criar</Badge>}
      {perm.can_edit && <Badge variant="outline" className="text-xs bg-primary/10">Editar</Badge>}
      {perm.can_delete && <Badge variant="outline" className="text-xs bg-destructive/10">Excluir</Badge>}
      {perm.can_approve && <Badge variant="outline" className="text-xs bg-warning/10">Aprovar</Badge>}
    </div>
  );

  if (!isAdmMaster) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas ADM Master pode gerenciar permissões.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Gerenciar Permissões
        </h1>
        <p className="page-subtitle">
          Configure as permissões de acesso por usuário ou departamento.
        </p>
      </div>

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Permissões ({filteredPermissions.length})</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar permissões..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchAllData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Permissão
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="users" className="gap-1">
                <Users className="h-3 w-3" />
                Por Usuário
              </TabsTrigger>
              <TabsTrigger value="departments" className="gap-1">
                <Building2 className="h-3 w-3" />
                Por Departamento
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário/Depto</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermissions.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {perm.user_name ? (
                          <>
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{perm.user_name}</span>
                          </>
                        ) : perm.department_name ? (
                          <>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{perm.department_name}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {perm.module_name || perm.dashboard_name || '-'}
                        </span>
                        {perm.dashboard_name && perm.module_name && (
                          <Badge variant="outline" className="text-xs">
                            {perm.module_name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PermissionBadges perm={perm} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(perm)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(perm)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPermissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma permissão encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPerm ? 'Editar Permissão' : 'Nova Permissão'}
            </DialogTitle>
            <DialogDescription>
              Configure as permissões de acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Usuário (opcional)</Label>
              <Select
                value={formData.user_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Departamento (opcional)</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select
                value={formData.module_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, module_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {modules.map(mod => (
                    <SelectItem key={mod.id} value={mod.id}>
                      {mod.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dashboard</Label>
              <Select
                value={formData.dashboard_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, dashboard_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um dashboard" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {dashboards.map(dash => (
                    <SelectItem key={dash.id} value={dash.id}>
                      {dash.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2">
              <Label>Ações Permitidas</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_view"
                    checked={formData.can_view}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, can_view: checked as boolean }))
                    }
                  />
                  <label htmlFor="can_view" className="text-sm">Visualizar</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_create"
                    checked={formData.can_create}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, can_create: checked as boolean }))
                    }
                  />
                  <label htmlFor="can_create" className="text-sm">Criar</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_edit"
                    checked={formData.can_edit}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, can_edit: checked as boolean }))
                    }
                  />
                  <label htmlFor="can_edit" className="text-sm">Editar</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_delete"
                    checked={formData.can_delete}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, can_delete: checked as boolean }))
                    }
                  />
                  <label htmlFor="can_delete" className="text-sm">Excluir</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_approve"
                    checked={formData.can_approve}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, can_approve: checked as boolean }))
                    }
                  />
                  <label htmlFor="can_approve" className="text-sm">Aprovar</label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingPerm ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
