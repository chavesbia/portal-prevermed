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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, RefreshCw, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  department_id: string | null;
  is_public: boolean;
  is_pinned: boolean;
  image_url: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

export default function GestaoComunicados() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    department_id: '',
    is_public: true,
    is_pinned: false,
    image_url: '',
    expires_at: '',
  });
  const [selectedAnnouncementImage, setSelectedAnnouncementImage] = useState<File | null>(null);
  const [announcementImagePreview, setAnnouncementImagePreview] = useState<string | null>(null);
  const [isUploadingAnnouncementImage, setIsUploadingAnnouncementImage] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [announcementsRes, departmentsRes] = await Promise.all([
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('departments').select('id, name').order('name'),
      ]);

      if (announcementsRes.error) throw announcementsRes.error;
      if (departmentsRes.error) throw departmentsRes.error;

      setAnnouncements((announcementsRes.data || []) as Announcement[]);
      setDepartments(departmentsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar comunicados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAnnouncementDialog = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setAnnouncementForm({
        title: announcement.title,
        content: announcement.content,
        department_id: announcement.department_id || '',
        is_public: announcement.is_public ?? true,
        is_pinned: announcement.is_pinned ?? false,
        image_url: announcement.image_url || '',
        expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
      });
      setAnnouncementImagePreview(announcement.image_url || null);
    } else {
      setEditingAnnouncement(null);
      setAnnouncementForm({
        title: '',
        content: '',
        department_id: '',
        is_public: true,
        is_pinned: false,
        image_url: '',
        expires_at: '',
      });
      setAnnouncementImagePreview(null);
    }
    setSelectedAnnouncementImage(null);
    setIsAnnouncementDialogOpen(true);
  };

  const handleAnnouncementImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG, GIF ou WEBP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setSelectedAnnouncementImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAnnouncementImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAnnouncementImage = async (): Promise<string | null> => {
    if (!selectedAnnouncementImage || !user?.id) return announcementForm.image_url || null;

    setIsUploadingAnnouncementImage(true);
    try {
      const fileExt = selectedAnnouncementImage.name.split('.').pop();
      const fileName = `announcements/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, selectedAnnouncementImage);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao enviar imagem');
      return null;
    } finally {
      setIsUploadingAnnouncementImage(false);
    }
  };

  const handleTogglePinned = async (announcement: Announcement) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_pinned: !announcement.is_pinned })
        .eq('id', announcement.id);

      if (error) throw error;
      toast.success(announcement.is_pinned ? 'Comunicado desfixado' : 'Comunicado fixado');
      fetchData();
    } catch (error) {
      console.error('Error toggling pinned:', error);
      toast.error('Erro ao fixar/desfixar comunicado');
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }

    try {
      let imageUrl = announcementForm.image_url;

      if (selectedAnnouncementImage) {
        const uploadedUrl = await uploadAnnouncementImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      if (editingAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title: announcementForm.title,
            content: announcementForm.content,
            department_id: announcementForm.department_id || null,
            is_public: announcementForm.is_public,
            is_pinned: announcementForm.is_pinned,
            image_url: imageUrl || null,
            expires_at: announcementForm.expires_at || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAnnouncement.id);

        if (error) throw error;
        toast.success('Comunicado atualizado');
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({
            title: announcementForm.title,
            content: announcementForm.content,
            department_id: announcementForm.department_id || null,
            is_public: announcementForm.is_public,
            is_pinned: announcementForm.is_pinned,
            image_url: imageUrl || null,
            expires_at: announcementForm.expires_at || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('Comunicado criado');
      }

      setIsAnnouncementDialogOpen(false);
      setSelectedAnnouncementImage(null);
      setAnnouncementImagePreview(null);
      fetchData();
    } catch (error) {
      console.error('Error saving announcement:', error);
      toast.error('Erro ao salvar comunicado');
    }
  };

  const handleDeleteAnnouncement = async (announcement: Announcement) => {
    if (!confirm(`Tem certeza que deseja excluir o comunicado "${announcement.title}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcement.id);

      if (error) throw error;
      toast.success('Comunicado excluído');
      fetchData();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Erro ao excluir comunicado');
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          Gestão de Comunicados
        </h1>
        <p className="page-subtitle">
          Publique avisos, comunicados e aniversários para o portal.
        </p>
      </div>

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">Comunicados ({announcements.length})</CardTitle>
            <CardDescription>Gerencie os comunicados internos da empresa.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => handleOpenAnnouncementDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Comunicado
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
                  <TableHead>Fixado</TableHead>
                  <TableHead>Visibilidade</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell className="font-medium max-w-[250px]">
                      <div className="flex items-center gap-2">
                        {announcement.image_url && (
                          <img
                            src={announcement.image_url}
                            alt=""
                            className="h-8 w-8 rounded object-cover"
                          />
                        )}
                        <div className="truncate">{announcement.title}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={announcement.is_pinned}
                        onCheckedChange={() => handleTogglePinned(announcement)}
                      />
                    </TableCell>
                    <TableCell>
                      {announcement.is_public ? (
                        <Badge variant="default">Público</Badge>
                      ) : (
                        <Badge variant="secondary">
                          {departments.find(d => d.id === announcement.department_id)?.name || 'Departamento'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(announcement.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenAnnouncementDialog(announcement)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAnnouncement(announcement)}
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

      {/* Announcement Dialog */}
      <Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? 'Editar Comunicado' : 'Novo Comunicado'}
            </DialogTitle>
            <DialogDescription>
              Configure as informações do comunicado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Atualização de Políticas Internas"
              />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo *</Label>
              <Textarea
                value={announcementForm.content}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite o conteúdo do comunicado..."
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Imagem (opcional)</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAnnouncementImageSelect}
                  className="flex-1"
                />
                {announcementImagePreview && (
                  <img
                    src={announcementImagePreview}
                    alt="Preview"
                    className="h-16 w-16 rounded object-cover border"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Visibilidade</Label>
                <Select
                  value={announcementForm.is_public ? 'public' : 'department'}
                  onValueChange={(value) => setAnnouncementForm(prev => ({
                    ...prev,
                    is_public: value === 'public',
                    department_id: value === 'public' ? '' : prev.department_id
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Público (todos)</SelectItem>
                    <SelectItem value="department">Por Departamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!announcementForm.is_public && (
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select
                    value={announcementForm.department_id}
                    onValueChange={(value) => setAnnouncementForm(prev => ({ ...prev, department_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Data de expiração (opcional)</Label>
                <Input
                  type="date"
                  value={announcementForm.expires_at}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, expires_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="announcement-pinned"
                checked={announcementForm.is_pinned}
                onCheckedChange={(checked) =>
                  setAnnouncementForm(prev => ({ ...prev, is_pinned: checked }))
                }
              />
              <label htmlFor="announcement-pinned">Fixar comunicado no topo</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsAnnouncementDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAnnouncement} disabled={isUploadingAnnouncementImage}>
                {isUploadingAnnouncementImage ? 'Enviando...' : (editingAnnouncement ? 'Salvar' : 'Publicar')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
