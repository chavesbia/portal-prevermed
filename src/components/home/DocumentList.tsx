import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, FileSpreadsheet, FileImage, File } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Document } from '@/types/portal';

interface DocumentListProps {
  documents: Document[];
  maxItems?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return FileText;
  if (fileType.includes('sheet') || fileType.includes('excel')) return FileSpreadsheet;
  if (fileType.includes('image')) return FileImage;
  return File;
};

export function DocumentList({ documents, maxItems = 5, showViewAll = true, onViewAll }: DocumentListProps) {
  const displayDocs = documents.slice(0, maxItems);

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" />
          Documentos Recentes
        </CardTitle>
        {showViewAll && documents.length > maxItems && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            Ver todos
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {displayDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum documento disponível
          </p>
        ) : (
          <div className="space-y-2">
            {displayDocs.map((doc) => {
              const FileIcon = getFileIcon(doc.file_type);
              const timeAgo = formatDistanceToNow(new Date(doc.created_at), {
                addSuffix: true,
                locale: ptBR,
              });

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-secondary text-secondary-foreground">
                    <FileIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.category} • {timeAgo}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    asChild
                  >
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
