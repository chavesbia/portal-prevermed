import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Search, Download, Eye, Folder, FolderOpen, FileSpreadsheet, FileImage, File, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DocItem {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  folder: string | null;
  created_at: string;
}

function extractStoragePath(doc: { file_path: string | null; file_url: string }) {
  if (doc.file_path) return doc.file_path;
  const m = doc.file_url?.match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function openSignedUrl(doc: { file_path: string | null; file_url: string }, download = false) {
  const path = extractStoragePath(doc);
  if (!path) {
    window.open(doc.file_url, '_blank');
    return;
  }
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 60 * 10, download ? { download: true } : undefined);
  if (error || !data?.signedUrl) {
    console.error('Signed URL error', error);
    return;
  }
  window.open(data.signedUrl, '_blank');
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return File;
  if (fileType.includes('pdf')) return FileText;
  if (fileType.includes('sheet') || fileType.includes('excel')) return FileSpreadsheet;
  if (fileType.includes('image')) return FileImage;
  return File;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export default function Documentos() {
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, description, file_url, file_type, file_size, folder, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
    } else {
      setDocuments(data || []);
    }
    setIsLoading(false);
  };

  const folders = [...new Set(documents.map(d => d.folder).filter(Boolean))] as string[];

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = !searchTerm ||
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFolder = selectedFolder === null
      ? true
      : selectedFolder === '__root__'
        ? !doc.folder
        : doc.folder === selectedFolder;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Documentos
        </h1>
        <p className="page-subtitle">
          Acesse os documentos disponíveis para você.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar - Folders */}
        <Card className="card-elevated md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Folder className="h-4 w-4 text-primary" />
              Pastas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                selectedFolder === null ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              Todos os documentos
            </button>
            <button
              onClick={() => setSelectedFolder('__root__')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                selectedFolder === '__root__' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              }`}
            >
              <File className="h-4 w-4" />
              Sem pasta
            </button>
            {folders.map(folder => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  selectedFolder === folder ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                }`}
              >
                <Folder className="h-4 w-4" />
                {folder}
                <Badge variant="secondary" className="ml-auto text-xs">
                  {documents.filter(d => d.folder === folder).length}
                </Badge>
              </button>
            ))}
            {folders.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-2">Nenhuma pasta criada</p>
            )}
          </CardContent>
        </Card>

        {/* Main content */}
        <Card className="card-elevated md:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {selectedFolder === null
                ? 'Todos os documentos'
                : selectedFolder === '__root__'
                  ? 'Sem pasta'
                  : selectedFolder}
              <span className="text-muted-foreground font-normal ml-2">({filteredDocs.length})</span>
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum documento encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc) => {
                  const Icon = getFileIcon(doc.file_type);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-secondary text-secondary-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {doc.folder && (
                            <>
                              <span className="flex items-center gap-1">
                                <Folder className="h-3 w-3" />
                                {doc.folder}
                              </span>
                              <ChevronRight className="h-3 w-3" />
                            </>
                          )}
                          <span>{formatSize(doc.file_size)}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Visualizar"
                        >
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Baixar"
                        >
                          <a href={doc.file_url} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
