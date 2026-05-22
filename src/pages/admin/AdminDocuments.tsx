import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Edit,
  Upload,
  Shield,
  Download,
  Globe,
  Building2,
  FolderPlus,
  Folder,
  Users,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DocumentRow {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  is_public: boolean | null;
  department_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  folder: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  position: string | null;
  profile_photo_url: string | null;
  hierarchy_position: string | null;
}

type VisibilityMode = 'public' | 'departments' | 'users' | 'leader';

export default function AdminDocuments() {
  const { role, user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [existingFolders, setExistingFolders] = useState<string[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Document departments & users for the selected doc (editing)
  const [docDepartmentIds, setDocDepartmentIds] = useState<string[]>([]);
  const [docUserIds, setDocUserIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: '',
    description: '',
    is_public: true,
    folder: '',
    visibility_mode: 'public' as VisibilityMode,
  });

  const isAdmin = role === 'adm_master';

  useEffect(() => {
    fetchDocuments();
    fetchDepartments();
    fetchUsers();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      toast.error('Erro ao carregar documentos');
    } else {
      setDocuments(data || []);
      // Extract unique folders
      const folders = [...new Set((data || []).map(d => d.folder).filter(Boolean))] as string[];
      setExistingFolders(folders);
    }
    setIsLoading(false);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    if (data) setDepartments(data);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, position, profile_photo_url, hierarchy_position')
      .eq('status', 'active')
      .order('full_name');
    if (data) setAllUsers(data);
  };

  const handleUpload = async () => {
    if (!uploadFile || !form.name) {
      toast.error('Nome e arquivo são obrigatórios');
      return;
    }

    setIsSaving(true);

    try {
      const filePath = `documents/${Date.now()}_${uploadFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadFile);

      if (uploadError) throw new Error('Erro ao fazer upload do arquivo.');

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      const folderValue = isCreatingFolder ? newFolderName.trim() : form.folder;

      const { data: insertedDoc, error: insertError } = await supabase.from('documents').insert({
        name: form.name,
        description: form.description || null,
        file_url: urlData.publicUrl,
        file_type: uploadFile.type,
        file_size: uploadFile.size,
        is_public: form.visibility_mode === 'public',
        department_id: null,
        uploaded_by: user?.id || null,
        folder: folderValue || null,
      }).select('id').single();

      if (insertError) throw insertError;

      // Insert department associations
      if (form.visibility_mode === 'departments' && docDepartmentIds.length > 0 && insertedDoc) {
        const deptInserts = docDepartmentIds.map(deptId => ({
          document_id: insertedDoc.id,
          department_id: deptId,
        }));
        await supabase.from('document_departments').insert(deptInserts);
      }

      // Insert user associations
      if ((form.visibility_mode === 'users' || form.visibility_mode === 'leader') && docUserIds.length > 0 && insertedDoc) {
        const userInserts = docUserIds.map(userId => ({
          document_id: insertedDoc.id,
          user_id: userId,
        }));
        await supabase.from('document_users').insert(userInserts);
      }

      toast.success('Documento adicionado com sucesso!');
      resetForm();
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Erro ao adicionar documento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (doc: DocumentRow) => {
    setSelectedDoc(doc);
    
    // Fetch doc departments
    const { data: deptData } = await supabase
      .from('document_departments')
      .select('department_id')
      .eq('document_id', doc.id);
    
    const { data: userData } = await supabase
      .from('document_users')
      .select('user_id')
      .eq('document_id', doc.id);

    const deptIds = (deptData || []).map(d => d.department_id);
    const userIds = (userData || []).map(u => u.user_id);

    let visMode: VisibilityMode = 'public';
    if (doc.is_public) {
      visMode = 'public';
    } else if (deptIds.length > 0) {
      visMode = 'departments';
    } else if (userIds.length > 0) {
      visMode = 'users';
    }

    setDocDepartmentIds(deptIds);
    setDocUserIds(userIds);
    setForm({
      name: doc.name,
      description: doc.description || '',
      is_public: doc.is_public ?? true,
      folder: doc.folder || '',
      visibility_mode: visMode,
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);

    try {
      const folderValue = isCreatingFolder ? newFolderName.trim() : form.folder;

      const { error } = await supabase
        .from('documents')
        .update({
          name: form.name,
          description: form.description || null,
          is_public: form.visibility_mode === 'public',
          department_id: null,
          folder: folderValue || null,
        })
        .eq('id', selectedDoc.id);

      if (error) throw error;

      // Update departments
      await supabase.from('document_departments').delete().eq('document_id', selectedDoc.id);
      if (form.visibility_mode === 'departments' && docDepartmentIds.length > 0) {
        const deptInserts = docDepartmentIds.map(deptId => ({
          document_id: selectedDoc.id,
          department_id: deptId,
        }));
        await supabase.from('document_departments').insert(deptInserts);
      }

      // Update users
      await supabase.from('document_users').delete().eq('document_id', selectedDoc.id);
      if ((form.visibility_mode === 'users' || form.visibility_mode === 'leader') && docUserIds.length > 0) {
        const userInserts = docUserIds.map(userId => ({
          document_id: selectedDoc.id,
          user_id: userId,
        }));
        await supabase.from('document_users').insert(userInserts);
      }

      toast.success('Documento atualizado!');
      resetForm();
      fetchDocuments();
    } catch (error: any) {
      console.error('Error updating document:', error);
      toast.error(error.message || 'Erro ao atualizar documento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doc: DocumentRow) => {
    if (!confirm(`Excluir o documento "${doc.name}"?`)) return;

    try {
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast.success('Documento excluído');
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir documento');
    }
  };

  const resetForm = () => {
    setForm({ name: '', description: '', is_public: true, folder: '', visibility_mode: 'public' });
    setUploadFile(null);
    setSelectedDoc(null);
    setIsEditing(false);
    setIsDialogOpen(false);
    setDocDepartmentIds([]);
    setDocUserIds([]);
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const toggleDepartment = (deptId: string) => {
    setDocDepartmentIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const toggleUser = (userId: string) => {
    setDocUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const leaders = allUsers.filter(u =>
    ['director', 'manager', 'coordinator', 'leader'].includes(u.hierarchy_position || '')
  );

  const filteredDocs = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.folder?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDeptNames = (doc: DocumentRow) => {
    // We'd need to fetch this per doc, for now show from state if it's the selected doc
    return null;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas administradores podem gerenciar documentos.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Gerenciar Documentos
        </h1>
        <p className="page-subtitle">
          Faça upload e gerencie documentos disponíveis no portal.
        </p>
      </div>

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Documentos ({filteredDocs.length})</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchDocuments}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Documento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Nenhum documento encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Pasta</TableHead>
                  <TableHead>Visibilidade</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        {doc.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {doc.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.folder ? (
                        <Badge variant="outline" className="gap-1">
                          <Folder className="h-3 w-3" />
                          {doc.folder}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {doc.is_public ? (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          Público
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          Restrito
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatSize(doc.file_size)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(doc)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(doc)}
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

      {/* Upload / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? <Edit className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
              {isEditing ? 'Editar Documento' : 'Novo Documento'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Atualize as informações do documento.'
                : 'Faça upload de um novo documento para o portal.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="space-y-2">
              <Label>Nome do Documento *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Manual do Colaborador"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição do documento..."
                rows={2}
              />
            </div>

            {/* Folder Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Folder className="h-3 w-3" />
                Pasta
              </Label>
              <div className="flex items-center gap-2">
                {!isCreatingFolder ? (
                  <>
                    <Select
                      value={form.folder}
                      onValueChange={(value) => setForm(prev => ({ ...prev, folder: value }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sem pasta (raiz)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem pasta (raiz)</SelectItem>
                        {existingFolders.map(folder => (
                          <SelectItem key={folder} value={folder}>
                            {folder}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsCreatingFolder(true)}
                      title="Criar nova pasta"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Nome da nova pasta"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                    >
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label>Arquivo *</Label>
                <Input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.png"
                />
                <p className="text-xs text-muted-foreground">
                  PDF, Word, Excel, PowerPoint, imagens (máx. 10MB)
                </p>
              </div>
            )}

            <Separator />

            {/* Visibility */}
            <div className="space-y-3">
              <Label>Visibilidade</Label>
              <Select
                value={form.visibility_mode}
                onValueChange={(value: VisibilityMode) => {
                  setForm(prev => ({ ...prev, visibility_mode: value }));
                  setDocDepartmentIds([]);
                  setDocUserIds([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <span className="flex items-center gap-2"><Globe className="h-3 w-3" /> Público (todos)</span>
                  </SelectItem>
                  <SelectItem value="departments">
                    <span className="flex items-center gap-2"><Building2 className="h-3 w-3" /> Por Departamento(s)</span>
                  </SelectItem>
                  <SelectItem value="users">
                    <span className="flex items-center gap-2"><Users className="h-3 w-3" /> Usuários Específicos</span>
                  </SelectItem>
                  <SelectItem value="leader">
                    <span className="flex items-center gap-2"><User className="h-3 w-3" /> Líder/Gestor Direto</span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Department multi-select */}
              {form.visibility_mode === 'departments' && (
                <div className="space-y-2">
                  <Label>Selecione os departamentos</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-auto">
                    {departments.map(dept => (
                      <div key={dept.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`doc-dept-${dept.id}`}
                          checked={docDepartmentIds.includes(dept.id)}
                          onCheckedChange={() => toggleDepartment(dept.id)}
                        />
                        <label htmlFor={`doc-dept-${dept.id}`} className="flex-1 cursor-pointer text-sm">
                          {dept.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Apenas membros dos departamentos selecionados poderão visualizar.
                  </p>
                </div>
              )}

              {/* User multi-select */}
              {form.visibility_mode === 'users' && (
                <div className="space-y-2">
                  <Label>Selecione os usuários</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-auto">
                    {allUsers.map(u => (
                      <div key={u.user_id} className="flex items-center gap-3">
                        <Checkbox
                          id={`doc-user-${u.user_id}`}
                          checked={docUserIds.includes(u.user_id)}
                          onCheckedChange={() => toggleUser(u.user_id)}
                        />
                        <label htmlFor={`doc-user-${u.user_id}`} className="flex-1 cursor-pointer text-sm">
                          {u.full_name}
                          {u.position && <span className="text-muted-foreground"> — {u.position}</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leader/Manager select */}
              {form.visibility_mode === 'leader' && (
                <div className="space-y-2">
                  <Label>Selecione o(s) líder/gestor</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-auto">
                    {leaders.map(u => (
                      <div key={u.user_id} className="flex items-center gap-3">
                        <Checkbox
                          id={`doc-leader-${u.user_id}`}
                          checked={docUserIds.includes(u.user_id)}
                          onCheckedChange={() => toggleUser(u.user_id)}
                        />
                        <label htmlFor={`doc-leader-${u.user_id}`} className="flex-1 cursor-pointer text-sm">
                          {u.full_name}
                          {u.position && <span className="text-muted-foreground"> — {u.position}</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={resetForm} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={isEditing ? handleUpdate : handleUpload} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? 'Salvando...' : 'Enviando...'}
                </>
              ) : (
                isEditing ? 'Salvar' : 'Enviar Documento'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}