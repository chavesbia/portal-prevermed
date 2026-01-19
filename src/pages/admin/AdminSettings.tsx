import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Link as LinkIcon,
  Plus, 
  Edit,
  Trash2,
  RefreshCw,
  Shield,
  ExternalLink,
  LayoutGrid
} from 'lucide-react';
import { toast } from 'sonner';

interface Module {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  is_active: boolean;
  created_at: string;
}

interface UsefulLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  sort_order: number | null;
  is_active: boolean;
}

export default function AdminSettings() {
  const { role } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [links, setLinks] = useState<UsefulLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('modules');
  
  // Module dialog
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState({
    name: '',
    description: '',
    icon: '',
    route: '',
    is_active: true,
  });

  // Link dialog
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<UsefulLink | null>(null);
  const [linkForm, setLinkForm] = useState({
    title: '',
    url: '',
    description: '',
    icon: '',
    category: '',
    sort_order: 0,
    is_active: true,
  });

  const isAdmMaster = role === 'adm_master';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [modulesRes, linksRes] = await Promise.all([
        supabase.from('modules').select('*').order('name'),
        supabase.from('useful_links').select('*').order('sort_order'),
      ]);

      if (modulesRes.error) throw modulesRes.error;
      if (linksRes.error) throw linksRes.error;

      setModules(modulesRes.data || []);
      setLinks(linksRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Module handlers
  const handleOpenModuleDialog = (module?: Module) => {
    if (module) {
      setEditingModule(module);
      setModuleForm({
        name: module.name,
        description: module.description || '',
        icon: module.icon || '',
        route: module.route || '',
        is_active: module.is_active ?? true,
      });
    } else {
      setEditingModule(null);
      setModuleForm({
        name: '',
        description: '',
        icon: '',
        route: '',
        is_active: true,
      });
    }
    setIsModuleDialogOpen(true);
  };

  const handleSaveModule = async () => {
    if (!moduleForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingModule) {
        const { error } = await supabase
          .from('modules')
          .update({
            name: moduleForm.name,
            description: moduleForm.description || null,
            icon: moduleForm.icon || null,
            route: moduleForm.route || null,
            is_active: moduleForm.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingModule.id);

        if (error) throw error;
        toast.success('Módulo atualizado');
      } else {
        const { error } = await supabase
          .from('modules')
          .insert({
            name: moduleForm.name,
            description: moduleForm.description || null,
            icon: moduleForm.icon || null,
            route: moduleForm.route || null,
            is_active: moduleForm.is_active,
          });

        if (error) throw error;
        toast.success('Módulo criado');
      }

      setIsModuleDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving module:', error);
      toast.error('Erro ao salvar módulo');
    }
  };

  const handleDeleteModule = async (module: Module) => {
    if (!confirm(`Tem certeza que deseja excluir o módulo "${module.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', module.id);

      if (error) throw error;
      toast.success('Módulo excluído');
      fetchData();
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error('Erro ao excluir módulo');
    }
  };

  const handleToggleModule = async (module: Module) => {
    try {
      const { error } = await supabase
        .from('modules')
        .update({ is_active: !module.is_active })
        .eq('id', module.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error toggling module:', error);
      toast.error('Erro ao atualizar módulo');
    }
  };

  // Link handlers
  const handleOpenLinkDialog = (link?: UsefulLink) => {
    if (link) {
      setEditingLink(link);
      setLinkForm({
        title: link.title,
        url: link.url,
        description: link.description || '',
        icon: link.icon || '',
        category: link.category || '',
        sort_order: link.sort_order || 0,
        is_active: link.is_active ?? true,
      });
    } else {
      setEditingLink(null);
      setLinkForm({
        title: '',
        url: '',
        description: '',
        icon: '',
        category: '',
        sort_order: links.length,
        is_active: true,
      });
    }
    setIsLinkDialogOpen(true);
  };

  const handleSaveLink = async () => {
    if (!linkForm.title.trim() || !linkForm.url.trim()) {
      toast.error('Título e URL são obrigatórios');
      return;
    }

    try {
      if (editingLink) {
        const { error } = await supabase
          .from('useful_links')
          .update({
            title: linkForm.title,
            url: linkForm.url,
            description: linkForm.description || null,
            icon: linkForm.icon || null,
            category: linkForm.category || null,
            sort_order: linkForm.sort_order,
            is_active: linkForm.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingLink.id);

        if (error) throw error;
        toast.success('Link atualizado');
      } else {
        const { error } = await supabase
          .from('useful_links')
          .insert({
            title: linkForm.title,
            url: linkForm.url,
            description: linkForm.description || null,
            icon: linkForm.icon || null,
            category: linkForm.category || null,
            sort_order: linkForm.sort_order,
            is_active: linkForm.is_active,
          });

        if (error) throw error;
        toast.success('Link criado');
      }

      setIsLinkDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving link:', error);
      toast.error('Erro ao salvar link');
    }
  };

  const handleDeleteLink = async (link: UsefulLink) => {
    if (!confirm(`Tem certeza que deseja excluir o link "${link.title}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('useful_links')
        .delete()
        .eq('id', link.id);

      if (error) throw error;
      toast.success('Link excluído');
      fetchData();
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Erro ao excluir link');
    }
  };

  const handleToggleLink = async (link: UsefulLink) => {
    try {
      const { error } = await supabase
        .from('useful_links')
        .update({ is_active: !link.is_active })
        .eq('id', link.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error toggling link:', error);
      toast.error('Erro ao atualizar link');
    }
  };

  if (!isAdmMaster) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas ADM Master pode acessar configurações.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configurações
        </h1>
        <p className="page-subtitle">
          Gerencie módulos e links úteis do sistema.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="modules" className="gap-1">
            <LayoutGrid className="h-4 w-4" />
            Módulos
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1">
            <LinkIcon className="h-4 w-4" />
            Links Úteis
          </TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Módulos ({modules.length})</CardTitle>
                <CardDescription>Gerencie os módulos disponíveis no sistema.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button onClick={() => handleOpenModuleDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Módulo
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
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Rota</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map((module) => (
                      <TableRow key={module.id}>
                        <TableCell className="font-medium">{module.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {module.description || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {module.route || '-'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={module.is_active}
                            onCheckedChange={() => handleToggleModule(module)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenModuleDialog(module)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteModule(module)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

        {/* Links Tab */}
        <TabsContent value="links">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Links Úteis ({links.length})</CardTitle>
                <CardDescription>Gerencie os links úteis exibidos na home.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button onClick={() => handleOpenLinkDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Link
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
                      <TableHead>Título</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">{link.title}</TableCell>
                        <TableCell>
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            {link.url.slice(0, 30)}...
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>
                          {link.category ? (
                            <Badge variant="outline">{link.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={link.is_active}
                            onCheckedChange={() => handleToggleLink(link)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenLinkDialog(link)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteLink(link)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
      </Tabs>

      {/* Module Dialog */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingModule ? 'Editar Módulo' : 'Novo Módulo'}
            </DialogTitle>
            <DialogDescription>
              Configure as informações do módulo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={moduleForm.name}
                onChange={(e) => setModuleForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Comunicados"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição do módulo..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone (Lucide)</Label>
                <Input
                  value={moduleForm.icon}
                  onChange={(e) => setModuleForm(prev => ({ ...prev, icon: e.target.value }))}
                  placeholder="Ex: megaphone"
                />
              </div>
              <div className="space-y-2">
                <Label>Rota</Label>
                <Input
                  value={moduleForm.route}
                  onChange={(e) => setModuleForm(prev => ({ ...prev, route: e.target.value }))}
                  placeholder="Ex: /comunicados"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="module-active"
                checked={moduleForm.is_active}
                onCheckedChange={(checked) => 
                  setModuleForm(prev => ({ ...prev, is_active: checked }))
                }
              />
              <label htmlFor="module-active">Módulo ativo</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsModuleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveModule}>
                {editingModule ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLink ? 'Editar Link' : 'Novo Link'}
            </DialogTitle>
            <DialogDescription>
              Configure as informações do link útil.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={linkForm.title}
                onChange={(e) => setLinkForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Portal do Colaborador"
              />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                value={linkForm.url}
                onChange={(e) => setLinkForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={linkForm.description}
                onChange={(e) => setLinkForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição do link"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={linkForm.category}
                  onChange={(e) => setLinkForm(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Ex: RH"
                />
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={linkForm.sort_order}
                  onChange={(e) => setLinkForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="link-active"
                checked={linkForm.is_active}
                onCheckedChange={(checked) => 
                  setLinkForm(prev => ({ ...prev, is_active: checked }))
                }
              />
              <label htmlFor="link-active">Link ativo</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveLink}>
                {editingLink ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
