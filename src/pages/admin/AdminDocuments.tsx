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
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DocumentRow {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  is_public: boolean | null;
  department_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

export default function AdminDocuments() {
  const { role, user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    is_public: true,
    department_id: '',
  });

  const isAdmin = role === 'adm_master' || role === 'adm_user';

  useEffect(() => {
    fetchDocuments();
    fetchDepartments();
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
    }
    setIsLoading(false);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    if (data) setDepartments(data);
  };

  const handleUpload = async () => {
    if (!uploadFile || !form.name) {
      toast.error('Nome e arquivo são obrigatórios');
      return;
    }

    setIsSaving(true);

    try {
      // Upload file to storage
      const fileExt = uploadFile.name.split('.').pop();
      const filePath = `documents/${Date.now()}_${uploadFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadFile);

      if (uploadError) {
        // If bucket doesn't exist, try creating it or use a different approach
        throw new Error('Erro ao fazer upload do arquivo. Verifique as configurações de armazenamento.');
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('documents').insert({
        name: form.name,
        description: form.description || null,
        file_url: urlData.publicUrl,
        file_type: uploadFile.type,
        file_size: uploadFile.size,
        is_public: form.is_public,
        department_id: form.department_id || null,
        uploaded_by: user?.id || null,
      });

      if (insertError) throw insertError;

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

  const handleEdit = (doc: DocumentRow) => {
    setSelectedDoc(doc);
    setForm({
      name: doc.name,
      description: doc.description || '',
      is_public: doc.is_public ?? true,
      department_id: doc.department_id || '',
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('documents')
        .update({
          name: form.name,
          description: form.description || null,
          is_public: form.is_public,
          department_id: form.department_id || null,
        })
        .eq('id', selectedDoc.id);

      if (error) throw error;

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
    setForm({ name: '', description: '', is_public: true, department_id: '' });
    setUploadFile(null);
    setSelectedDoc(null);
    setIsEditing(false);
    setIsDialogOpen(false);
  };

  const filteredDocs = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDeptName = (deptId: string | null) => {
    if (!deptId) return null;
    return departments.find(d => d.id === deptId)?.name || null;
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
                  <TableHead>Visibilidade</TableHead>
                  <TableHead>Departamento</TableHead>
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
                      {doc.is_public ? (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          Público
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          Departamento
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {getDeptName(doc.department_id) || '-'}
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
        <DialogContent className="max-w-lg">
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

          <div className="space-y-4">
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

            <div className="space-y-3">
              <Label>Visibilidade</Label>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="is_public"
                  checked={form.is_public}
                  onCheckedChange={(checked) =>
                    setForm(prev => ({ ...prev, is_public: !!checked, department_id: checked ? '' : prev.department_id }))
                  }
                />
                <label htmlFor="is_public" className="text-sm cursor-pointer">
                  Público (visível para todos os colaboradores)
                </label>
              </div>

              {!form.is_public && (
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select
                    value={form.department_id}
                    onValueChange={(value) => setForm(prev => ({ ...prev, department_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Apenas membros deste departamento poderão visualizar o documento.
                  </p>
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
