import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Download, Trash2, Upload, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOSAnexos } from '@/hooks/useOSAnexos';
import {
  OSAnexo, OSAnexoCategoria, OS_ANEXO_CATEGORIA_OPTIONS,
  osAnexoCategoriaColors, osAnexoCategoriaLabel,
} from '@/types/osAnexos';
import { OrdemServico } from '@/types/os';

interface Props {
  ordem: OrdemServico;
  canEdit: boolean;
}

const formatSize = (b: number | null) => {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export function OSAnexosTab({ ordem, canEdit }: Props) {
  const { anexos, isLoading, uploadAnexo, deleteAnexo, getSignedUrl } = useOSAnexos(ordem.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<OSAnexoCategoria>('art');
  const [descricao, setDescricao] = useState('');
  const [dataVenc, setDataVenc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<OSAnexo | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadAnexo({
      file, categoria,
      descricao: descricao || undefined,
      data_vencimento: dataVenc || null,
    });
    setUploading(false);
    setDescricao(''); setDataVenc('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleDownload = async (anexo: OSAnexo) => {
    const url = await getSignedUrl(anexo);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as OSAnexoCategoria)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OS_ANEXO_CATEGORIA_OPTIONS.map(c => (
                    <SelectItem key={c} value={c}>{osAnexoCategoriaLabel[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: ART emitida em ..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vencimento (opcional)</Label>
              <Input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
            </div>
          </div>
          <div>
            <input ref={fileInput} type="file" onChange={handleFile} className="hidden" />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Enviando...' : 'Selecionar arquivo'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
      ) : anexos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhum anexo. {canEdit && 'Envie o primeiro arquivo acima.'}
        </div>
      ) : (
        <div className="space-y-2">
          {anexos.map(a => {
            const vencido = a.data_vencimento && new Date(a.data_vencimento) < new Date();
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{a.nome}</span>
                    <Badge variant="outline" className={osAnexoCategoriaColors[a.categoria]}>
                      {osAnexoCategoriaLabel[a.categoria]}
                    </Badge>
                    {a.data_vencimento && (
                      <Badge variant="outline" className={vencido ? 'bg-red-100 text-red-700 border-red-300' : ''}>
                        {vencido && <AlertTriangle className="h-3 w-3 mr-1" />}
                        Vence {format(parseISO(a.data_vencimento), 'dd/MM/yyyy')}
                      </Badge>
                    )}
                  </div>
                  {a.descricao && <p className="text-sm text-muted-foreground mt-1">{a.descricao}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatSize(a.tamanho_bytes)} · {format(parseISO(a.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(a)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(a)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo "{toDelete?.nome}" será removido permanentemente. Apenas o ADM Master pode fazer isso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (toDelete) { await deleteAnexo(toDelete); setToDelete(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
