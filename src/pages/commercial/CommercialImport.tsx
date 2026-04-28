import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, RefreshCw, ArrowLeft, XCircle } from 'lucide-react';
import { parseExcelFile, analyzeImport, executeImport, type ImportItem, type ImportResult } from '@/lib/commercial-import';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

type Step = 'upload' | 'preview' | 'importing' | 'result';

export default function CommercialImport({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) {
        toast({ title: 'Planilha vazia', description: 'Nenhum registro encontrado', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const analyzed = await analyzeImport(rows);
      setItems(analyzed);
      setStep('preview');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setStep('importing');
    try {
      const res = await executeImport(items);
      setResult(res);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['commercial-clients'] });
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
      setStep('preview');
    }
  }, [items, queryClient]);

  const counts = {
    novos: items.filter(i => i.status === 'novo').length,
    atualizar: items.filter(i => i.status === 'atualizar').length,
    identicos: items.filter(i => i.status === 'identico').length,
    erros: items.filter(i => i.status === 'erro').length,
  };

  const statusBadge = (status: ImportItem['status']) => {
    const map = {
      novo: { label: 'Novo', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
      atualizar: { label: 'Atualizar', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
      identico: { label: 'Idêntico', className: 'bg-muted text-muted-foreground' },
      erro: { label: 'Erro', className: 'bg-destructive/10 text-destructive' },
    };
    const s = map[status];
    return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
  };

  if (step === 'upload' || loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" /> Importar Clientes do SOC
              </CardTitle>
              <CardDescription>Faça upload da planilha exportada do SOC para importar a base de clientes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-10 border-2 border-dashed rounded-lg">
            {loading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Analisando planilha...</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">Selecione um arquivo .xls ou .xlsx</p>
                <Button onClick={() => fileRef.current?.click()}>Selecionar Arquivo</Button>
                <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} />
              </>
            )}
          </div>
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Campos manuais (contrato, proposta, vigência, observações e anexos) <strong>não serão sobrescritos</strong> em clientes já existentes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (step === 'result' && result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Importação Concluída
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Total Lido" value={result.total} />
            <SummaryCard label="Inseridos" value={result.inserted} color="text-emerald-600" />
            <SummaryCard label="Atualizados" value={result.updated} color="text-amber-600" />
            <SummaryCard label="Ignorados" value={result.skipped} color="text-muted-foreground" />
            <SummaryCard label="Com Erro" value={result.errors} color="text-destructive" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            <Button variant="outline" onClick={() => { setStep('upload'); setItems([]); setResult(null); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Nova Importação
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preview + Importing
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Prévia da Importação
            </CardTitle>
            <CardDescription>{fileName} — {items.length} registros analisados</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('upload'); setItems([]); }} disabled={step === 'importing'}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={step === 'importing' || (counts.novos + counts.atualizar) === 0}>
              {step === 'importing' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Importar {counts.novos + counts.atualizar} registros
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            {counts.novos} novos
          </Badge>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            {counts.atualizar} a atualizar
          </Badge>
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            {counts.identicos} idênticos
          </Badge>
          {counts.erros > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive">
              {counts.erros} com erro
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[450px] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Status</TableHead>
                <TableHead>Cód. SOC</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead className="text-right">Vidas</TableHead>
                <TableHead>Subgrupo</TableHead>
                <TableHead>GR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i} className={item.status === 'identico' ? 'opacity-50' : ''}>
                  <TableCell>{statusBadge(item.status)}</TableCell>
                  <TableCell className="font-mono text-xs">{item.row.soc_code}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{item.row.company_name}</TableCell>
                  <TableCell className="font-mono text-xs">{formatCnpj(item.row.cnpj)}</TableCell>
                  <TableCell>{[item.row.city, item.row.state].filter(Boolean).join('/')}</TableCell>
                  <TableCell className="text-right">{item.row.active_lives}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-xs">{item.row.subgroup}</TableCell>
                  <TableCell>{item.row.risk_grade || <span className="text-muted-foreground italic text-xs">N/I</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={`text-2xl font-bold ${color || ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function formatCnpj(cnpj: string | null): string {
  if (!cnpj || cnpj.length !== 14) return cnpj || '—';
  return `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12)}`;
}
