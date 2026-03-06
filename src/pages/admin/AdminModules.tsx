import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, RefreshCw, Shield, Search, Boxes, Users, Calendar, X, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Module {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  base_url: string | null;
  app_type: 'internal' | 'external' | 'iframe' | null;
  requires_permission: boolean | null;
  is_active: boolean | null;
  logo_url: string | null;
  sort_order: number | null;
  created_at: string;
}

interface UserAccess {
  id: string;
  user_id: string;
  module_id: string;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  is_active: boolean;
  module_name?: string;
  user_name?: string;
  user_photo?: string;
  granted_by_name?: string;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  profile_photo_url: string | null;
  email: string;
  position: string | null;
}

const appTypeLabels: Record<string, string> = {
  internal: 'Interno',
  external: 'Externo',
  iframe: 'iFrame',
};

const appTypeBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  internal: 'default',
  external: 'secondary',
  iframe: 'outline',
};

export default function AdminModules() {
  const { role, user } = useAuth();
  const [activeTab, setActiveTab] = useState('modules');

  // Module state
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [moduleDialog, setModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState({
    name: '',
    description: '',
    base_url: '',
    app_type: 'internal' as string,
    logo_url: '',
    icon: '',
    route: '',
    requires_permission: true,
    sort_order: 0,
    is_active: true,
  });

  // Access state
  const [accesses, setAccesses] = useState<UserAccess[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [accessDialog, setAccessDialog] = useState(false);
  const [accessForm, setAccessForm] = useState({
    user_id: '',
    module_id: '',
    expires_at: '',
  });
  const [searchUser, setSearchUser] = useState('');
  const [filterModule, setFilterModule] = useState('all');

  // Fetch modules
  const fetchModules = useCallback(async () => {
    setLoadingModules(true);
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      toast({ title: 'Erro ao carregar módulos', description: error.message, variant: 'destructive' });
    } else {
      setModules(data || []);
    }
    setLoadingModules(false);
  }, []);

  // Fetch accesses
  const fetchAccesses = useCallback(async () => {
    setLoadingAccess(true);
    const { data, error } = await supabase
      .from('user_module_access')
      .select('*')
      .order('granted_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar acessos', description: error.message, variant: 'destructive' });
      setLoadingAccess(false);
      return;
    }

    // Enrich with user names and module names
    const userIds = [...new Set((data || []).map(a => a.user_id))];
    const grantedByIds = [...new Set((data || []).filter(a => a.granted_by).map(a => a.granted_by!))];
    const allUserIds = [...new Set([...userIds, ...grantedByIds])];

    let profilesMap: Record<string, { full_name: string; profile_photo_url: string | null }> = {};
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, profile_photo_url')
        .in('user_id', allUserIds);
      (profiles || []).forEach(p => {
        profilesMap[p.user_id] = { full_name: p.full_name, profile_photo_url: p.profile_photo_url };
      });
    }

    const enriched: UserAccess[] = (data || []).map(a => ({
      ...a,
      user_name: profilesMap[a.user_id]?.full_name || 'Desconhecido',
      user_photo: profilesMap[a.user_id]?.profile_photo_url || null,
      granted_by_name: a.granted_by ? profilesMap[a.granted_by]?.full_name || '—' : '—',
      module_name: modules.find(m => m.id === a.module_id)?.name || 'Módulo removido',
    }));

    setAccesses(enriched);
    setLoadingAccess(false);
  }, [modules]);

  // Fetch users for access dialog
  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, profile_photo_url, email, position')
      .eq('status', 'active')
      .order('full_name');
    setUsers(data || []);
  }, []);

  useEffect(() => {
    fetchModules();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (modules.length > 0) fetchAccesses();
  }, [modules]);

  // Module CRUD
  const openModuleDialog = (mod?: Module) => {
    if (mod) {
      setEditingModule(mod);
      setModuleForm({
        name: mod.name,
        description: mod.description || '',
        base_url: mod.base_url || '',
        app_type: mod.app_type || 'internal',
        logo_url: mod.logo_url || '',
        icon: mod.icon || '',
        route: mod.route || '',
        requires_permission: mod.requires_permission ?? true,
        sort_order: mod.sort_order ?? 0,
        is_active: mod.is_active ?? true,
      });
    } else {
      setEditingModule(null);
      setModuleForm({
        name: '',
        description: '',
        base_url: '',
        app_type: 'internal',
        logo_url: '',
        icon: '',
        route: '',
        requires_permission: true,
        sort_order: 0,
        is_active: true,
      });
    }
    setModuleDialog(true);
  };

  const saveModule = async () => {
    const payload = {
      name: moduleForm.name,
      description: moduleForm.description || null,
      base_url: moduleForm.base_url || null,
      app_type: moduleForm.app_type as 'internal' | 'external' | 'iframe',
      logo_url: moduleForm.logo_url || null,
      icon: moduleForm.icon || null,
      route: moduleForm.route || null,
      requires_permission: moduleForm.requires_permission,
      sort_order: moduleForm.sort_order,
      is_active: moduleForm.is_active,
    };

    if (editingModule) {
      const { error } = await supabase.from('modules').update(payload).eq('id', editingModule.id);
      if (error) {
        toast({ title: 'Erro ao atualizar módulo', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Módulo atualizado com sucesso' });
    } else {
      const { error } = await supabase.from('modules').insert(payload);
      if (error) {
        toast({ title: 'Erro ao criar módulo', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Módulo criado com sucesso' });
    }
    setModuleDialog(false);
    fetchModules();
  };

  const deleteModule = async (id: string) => {
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir módulo', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Módulo excluído' });
    fetchModules();
  };

  const toggleModuleActive = async (mod: Module) => {
    const { error } = await supabase.from('modules').update({ is_active: !mod.is_active }).eq('id', mod.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    fetchModules();
  };

  // Access CRUD
  const openAccessDialog = () => {
    setAccessForm({ user_id: '', module_id: '', expires_at: '' });
    setAccessDialog(true);
  };

  const saveAccess = async () => {
    if (!accessForm.user_id || !accessForm.module_id) {
      toast({ title: 'Selecione usuário e módulo', variant: 'destructive' });
      return;
    }

    const payload: any = {
      user_id: accessForm.user_id,
      module_id: accessForm.module_id,
      granted_by: user?.id || null,
      is_active: true,
    };
    if (accessForm.expires_at) {
      payload.expires_at = accessForm.expires_at;
    }

    const { error } = await supabase.from('user_module_access').upsert(payload, { onConflict: 'user_id,module_id' });
    if (error) {
      toast({ title: 'Erro ao conceder acesso', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Acesso concedido com sucesso' });
    setAccessDialog(false);
    fetchAccesses();
  };

  const toggleAccess = async (access: UserAccess) => {
    const { error } = await supabase
      .from('user_module_access')
      .update({ is_active: !access.is_active })
      .eq('id', access.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    fetchAccesses();
  };

  const removeAccess = async (id: string) => {
    const { error } = await supabase.from('user_module_access').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover acesso', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Acesso removido' });
    fetchAccesses();
  };

  const getInitials = (name: string) => {
    return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  // Filter accesses
  const filteredAccesses = accesses.filter(a => {
    const matchesUser = !searchUser || a.user_name?.toLowerCase().includes(searchUser.toLowerCase());
    const matchesModule = filterModule === 'all' || a.module_id === filterModule;
    return matchesUser && matchesModule;
  });

  if (role !== 'adm_master') {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas ADM Master pode acessar esta página.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Módulos</h1>
        <p className="text-muted-foreground">Cadastre, configure e gerencie os acessos aos módulos do ecossistema.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="modules" className="gap-2">
            <Boxes className="h-4 w-4" />
            Módulos
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <Users className="h-4 w-4" />
            Acessos
          </TabsTrigger>
        </TabsList>

        {/* ============ TAB: MÓDULOS ============ */}
        <TabsContent value="modules" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Módulos Cadastrados</CardTitle>
                <CardDescription>{modules.length} módulo(s) no ecossistema</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={fetchModules}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button onClick={() => openModuleDialog()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Módulo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingModules ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : modules.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum módulo cadastrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>URL Base</TableHead>
                      <TableHead>Permissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map(mod => (
                      <TableRow key={mod.id}>
                        <TableCell className="font-mono text-muted-foreground">{mod.sort_order ?? 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {mod.logo_url && (
                              <img src={mod.logo_url} alt="" className="h-6 w-6 rounded object-contain" />
                            )}
                            <div>
                              <span className="font-medium">{mod.name}</span>
                              {mod.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{mod.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={appTypeBadgeVariant[mod.app_type || 'internal']}>
                            {appTypeLabels[mod.app_type || 'internal']}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px] block">
                            {mod.base_url || mod.route || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {mod.requires_permission ? (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <ShieldCheck className="h-3 w-3" /> Sim
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Livre</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={mod.is_active ?? false}
                            onCheckedChange={() => toggleModuleActive(mod)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openModuleDialog(mod)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir módulo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Isso removerá o módulo "{mod.name}" e todos os acessos vinculados. Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteModule(mod.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB: ACESSOS ============ */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Acessos por Usuário</CardTitle>
                <CardDescription>Gerencie quem pode acessar cada módulo</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={fetchAccesses}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button onClick={openAccessDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Conceder Acesso
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome do usuário..."
                    value={searchUser}
                    onChange={e => setSearchUser(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterModule} onValueChange={setFilterModule}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Filtrar por módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os módulos</SelectItem>
                    {modules.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingAccess ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : filteredAccesses.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum acesso encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Concedido por</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Expiração</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccesses.map(access => (
                      <TableRow key={access.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={access.user_photo || ''} />
                              <AvatarFallback className="text-xs">
                                {getInitials(access.user_name || '')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{access.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{access.module_name}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{access.granted_by_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(access.granted_at), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {access.expires_at ? (
                            <span className="text-xs font-mono">
                              {format(new Date(access.expires_at), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem expiração</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={access.is_active}
                            onCheckedChange={() => toggleAccess(access)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O acesso de {access.user_name} ao módulo {access.module_name} será removido permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeAccess(access.id)}>Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ DIALOG: MÓDULO ============ */}
      <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Nome *</Label>
                <Input value={moduleForm.name} onChange={e => setModuleForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Precificação" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Descrição</Label>
                <Textarea value={moduleForm.description} onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição do módulo" rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de App</Label>
                <Select value={moduleForm.app_type} onValueChange={v => setModuleForm(f => ({ ...f, app_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Interno</SelectItem>
                    <SelectItem value="external">Externo</SelectItem>
                    <SelectItem value="iframe">iFrame</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={moduleForm.sort_order} onChange={e => setModuleForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>URL Base</Label>
                <Input value={moduleForm.base_url} onChange={e => setModuleForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://modulo.lovable.app" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Rota interna</Label>
                <Input value={moduleForm.route} onChange={e => setModuleForm(f => ({ ...f, route: e.target.value }))} placeholder="/modulo" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>URL do Logo</Label>
                <Input value={moduleForm.logo_url} onChange={e => setModuleForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Ícone (Lucide)</Label>
                <Input value={moduleForm.icon} onChange={e => setModuleForm(f => ({ ...f, icon: e.target.value }))} placeholder="calculator" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={moduleForm.requires_permission} onCheckedChange={v => setModuleForm(f => ({ ...f, requires_permission: v }))} />
                <Label>Exige permissão individual</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={moduleForm.is_active} onCheckedChange={v => setModuleForm(f => ({ ...f, is_active: v }))} />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialog(false)}>Cancelar</Button>
            <Button onClick={saveModule} disabled={!moduleForm.name}>{editingModule ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ DIALOG: ACESSO ============ */}
      <Dialog open={accessDialog} onOpenChange={setAccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conceder Acesso a Módulo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Usuário *</Label>
              <Select value={accessForm.user_id} onValueChange={v => setAccessForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name} {u.position ? `— ${u.position}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Módulo *</Label>
              <Select value={accessForm.module_id} onValueChange={v => setAccessForm(f => ({ ...f, module_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o módulo" /></SelectTrigger>
                <SelectContent>
                  {modules.filter(m => m.is_active).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiração (opcional)</Label>
              <Input type="date" value={accessForm.expires_at} onChange={e => setAccessForm(f => ({ ...f, expires_at: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialog(false)}>Cancelar</Button>
            <Button onClick={saveAccess} disabled={!accessForm.user_id || !accessForm.module_id}>Conceder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
