import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Upload, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { importarVendas, useInvalidateVendas, useVendasImportacoes } from '@/hooks/useVendas';
import { parseSkyworkVendas, readSkyworkFile, SkyworkVenda, brl, VENDEDOR_FATURAMENTO } from '@/lib/vendas/skywork';
import { auditVendas } from '@/lib/vendas/audit';

export function VendasImportacao() {
  const { user } = useAuth();
  const invalidate = useInvalidateVendas();
  const { data: historico = [] } = useVendasImportacoes();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<SkyworkVenda[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const vendas = parseSkyworkVendas(await readSkyworkFile(f));
      setArquivo(f); setPreview(vendas);
    } catch (e: any) {
      toast({ title: 'Arquivo inválido', description: e.message, variant: 'destructive' });
    }
  };

  const confirmar = async () => {
    if (!preview || !arquivo) return;
    setProgress(0);
    try {
      const r = await importarVendas(preview, arquivo.name, user?.id ?? null, setProgress);
      await auditVendas(user?.id, 'import', null, { arquivo: arquivo.name, ...r });
      toast({ title: 'Importação concluída', description: `${r.inseridas} novas e ${r.atualizadas} atualizadas.` });
      setPreview(null); setArquivo(null);
      invalidate();
    } catch (e: any) {
      toast({ title: 'Erro na importação', description: e.message, variant: 'destructive' });
    } finally {
      setProgress(null);
    }
  };

  const resumo = preview && {
    concl: preview.filter(v => v.situacao === 'Concluído'),
    semVend: preview.filter(v => v.situacao === 'Concluído' && !v.vendedor).length,
    fat: preview.filter(v => v.vendedor === VENDEDOR_FATURAMENTO).length,
    comp: preview.filter(v => v.compartilhada).length,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-lg">Importar planilha do Skywork</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-muted/50">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">{arquivo ? arquivo.name : 'Clique para escolher o arquivo .csv de Vendas'}</span>
            <span className="text-xs text-muted-foreground">Pode subir a mesma planilha várias vezes: vendas existentes são atualizadas, sem duplicar.</span>
            <input type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          </label>

          {resumo && (
            <div className="space-y-2 text-sm">
              <div>Vendas no arquivo: <strong>{preview!.length}</strong></div>
              <div>Concluídas: <strong>{resumo.concl.length}</strong> ({brl(resumo.concl.reduce((s, v) => s + v.valor, 0))})</div>
              <div>Vendedor Faturamento (não gera comissão): <strong>{resumo.fat}</strong></div>
              <div>Vendas compartilhadas (100% ao 1º vendedor): <strong>{resumo.comp}</strong></div>
              {resumo.semVend > 0 && (
                <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> {resumo.semVend} concluídas sem vendedor</div>
              )}
              <p className="text-xs text-muted-foreground">A classificação Novo/Renovação e as validações já feitas são mantidas.</p>
              {progress !== null && <Progress value={progress} />}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" disabled={progress !== null} onClick={() => { setPreview(null); setArquivo(null); }}>Cancelar</Button>
                <Button onClick={confirmar} disabled={progress !== null}>
                  {progress !== null && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar importação
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Últimas importações</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y text-sm">
            {historico.map(h => (
              <div key={h.id} className="py-2 flex justify-between gap-3">
                <div>
                  <div className="font-medium">{h.arquivo_nome}</div>
                  <div className="text-xs text-muted-foreground">{format(parseISO(h.created_at), 'dd/MM/yyyy HH:mm')}</div>
                </div>
                <div className="text-right text-xs">
                  <div>{h.total_vendas} vendas</div>
                  <div className="text-muted-foreground">{h.inseridas} novas · {h.atualizadas} atualizadas</div>
                </div>
              </div>
            ))}
            {historico.length === 0 && <div className="py-6 text-center text-muted-foreground">Nenhuma importação ainda.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
