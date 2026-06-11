import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { parseExcelFile, analyzeImport, executeImport, type ImportItem, type ImportResult } from '@/lib/commercial-import';
import { parseCatalogoFile, analyzeCatalogoImport, executeCatalogoImport, type CatalogoItem, type CatalogoResult } from '@/lib/catalogo-import';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

type Step = 'upload' | 'preview' | 'importing' | 'result';
type Mode = 'soc' | 'catalogo';

export default function CommercialImport({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>('soc');
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [catItems, setCatItems] = useState<CatalogoItem[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [catResult, setCatResult] = useState<CatalogoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = useCallback(() => {
    setStep('upload');
    setItems([]); setCatItems([]);
    setResult(null); setCatResult(null);
    setFileName('');
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      if (mode === 'soc') {
        const rows = await parseExcelFile(file);
        if (rows.length === 0) {
          toast({ title: 'Planilha vazia', description: 'Nenhum registro encontrado', variant: 'destructive' });
          setLoading(false); return;
        }
        const analyzed = await analyzeImport(rows);
        setItems(analyzed);
      } else {
        const rows = await parseCatalogoFile(file);
        if (rows.length === 0) {
          toast({ title: 'Planilha vazia', description: 'Nenhum contrato encontrado na aba Catálogo', variant: 'destructive' });
          setLoading(false); return;
        }
        const analyzed = await analyzeCatalogoImport(rows);
        setCatItems(analyzed);
      }
      setStep('preview');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [mode]);

  const handleImport = useCallback(async () => {
    setStep('importing');
    try {
      if (mode === 'soc') {
        const res = await executeImport(items);
        setResult(res);
        queryClient.invalidateQueries({ queryKey: ['commercial-clients'] });
      } else {
        const res = await executeCatalogoImport(catItems);
        setCatResult(res);
        queryClient.invalidateQueries({ queryKey: ['commercial-clients'] });
        queryClient.invalidateQueries({ queryKey: ['commercial-contracts'] });
      }
      setStep('result');
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
      setStep('preview');
    }
  }, [mode, items, catItems, queryClient]);

  // ===== UPLOAD STEP =====
  if (step === 'upload' || loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" /> Importação Comercial
              </CardTitle>
              <CardDescription>Escolha o tipo de importação e envie a planilha correspondente</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); reset(); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="soc">SOC — Clientes</TabsTrigger>
              <TabsTrigger value="catalogo">Catálogo Geral — Contratos</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col items-center gap-4 py-10 border-2 border-dashed rounded-lg">
            {loading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Analisando planilha...</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground text-sm text-center px-4">
                  {mode === 'soc'
                    ? 'Selecione a planilha do SOC (.xls/.xlsx) — cadastra/atualiza clientes.'
                    : 'Selecione o Catálogo Geral (.xlsx) — cria histórico de contratos por CNPJ na aba "Catalogo".'}
                </p>
                <Button onClick={() => fileRef.current?.click()}>Selecionar Arquivo</Button>
                <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} />
              </>
            )}
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {mode === 'soc'
                ? <>Campos manuais (contrato, proposta, vigência, observações e anexos) <strong>não serão sobrescritos</strong> em clientes já existentes.</>
                : <>Match por <strong>CNPJ</strong>. Cada linha vira um contrato no histórico do cliente. Contratos com mesmo número não são duplicados. Para CNPJs novos, o contrato mais recente não vencido é marcado como vigente.</>}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // ===== RESULT STEP =====
  if (step === 'result') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Importação Concluída
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'soc' && result && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Total Lido" value={result.total} />
              <SummaryCard label="Inseridos" value={result.inserted} color="text-emerald-600" />
              <SummaryCard label="Atualizados" value={result.updated} color="text-amber-600" />
              <SummaryCard label="Ignorados" value={result.skipped} color="text-muted-foreground" />
              <SummaryCard label="Com Erro" value={result.errors} color="text-destructive" />
            </div>
          )}
          {mode === 'catalogo' && catResult && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Linhas Lidas" value={catResult.total} />
              <SummaryCard label="Clientes Novos" value={catResult.clientesNovos} color="text-emerald-600" />
              <SummaryCard label="Contratos Inseridos" value={catResult.contratosInseridos} color="text-emerald-600" />
              <SummaryCard label="Duplicados" value={catResult.duplicados} color="text-muted-foreground" />
              <SummaryCard label="Com Erro" value={catResult.erros} color="text-destructive" />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            <Button variant="outline" onClick={reset}>
              <RefreshCw className="h-4 w-4 mr-1" /> Nova Importação
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ===== PREVIEW STEP =====
  if (mode === 'soc') {
    const counts = {
      novos: items.filter(i => i.status === 'novo').length,
      atualizar: items.filter(i => i.status === 'atualizar').length,
      identicos: items.filter(i => i.status === 'identico').length,
      erros: items.filter(i => i.status === 'erro').length,
    };
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Prévia — SOC</CardTitle>
              <CardDescription>{fileName} — {items.length} registros analisados</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={step === 'importing'}>Cancelar</Button>
              <Button onClick={handleImport} disabled={step === 'importing' || (counts.novos + counts.atualizar) === 0}>
                {step === 'importing' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Importar {counts.novos + counts.atualizar} registros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{counts.novos} novos</Badge>
            <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{counts.atualizar} a atualizar</Badge>
            <Badge variant="outline" className="bg-muted text-muted-foreground">{counts.identicos} idênticos</Badge>
            {counts.erros > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive">{counts.erros} com erro</Badge>}
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
                    <TableCell>{socStatusBadge(item.status)}</TableCell>
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

  // ===== PREVIEW STEP — CATALOGO =====
  const catCounts = {
    novoCliente: catItems.filter(i => i.status === 'novo_cliente').length,
    contratoNovo: catItems.filter(i => i.status === 'contrato_novo').length,
    duplicados: catItems.filter(i => i.status === 'contrato_duplicado').length,
    erros: catItems.filter(i => i.status === 'erro').length,
    revisao: catItems.filter(i => i.row.revisao_pendente && i.status !== 'erro').length,
    aImportar: catItems.filter(i => i.status === 'novo_cliente' || i.status === 'contrato_novo').length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Prévia — Catálogo Geral</CardTitle>
            <CardDescription>{fileName} — {catItems.length} linhas analisadas</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} disabled={step === 'importing'}>Cancelar</Button>
            <Button onClick={handleImport} disabled={step === 'importing' || catCounts.aImportar === 0}>
              {step === 'importing' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Importar {catCounts.aImportar} contratos
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{catCounts.novoCliente} cliente+contrato novos</Badge>
          <Badge variant="outline" className="bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400">{catCounts.contratoNovo} contratos novos (cliente existente)</Badge>
          <Badge variant="outline" className="bg-muted text-muted-foreground">{catCounts.duplicados} duplicados</Badge>
          {catCounts.revisao > 0 && <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{catCounts.revisao} p/ revisão</Badge>}
          {catCounts.erros > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive">{catCounts.erros} com erro</Badge>}
        </div>
        <ScrollArea className="h-[450px] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Nº Contrato</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Vigente?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catItems.map((item, i) => (
                <TableRow key={i} className={item.status === 'contrato_duplicado' || item.status === 'erro' ? 'opacity-60' : ''}>
                  <TableCell>{catStatusBadge(item.status, item.errorMsg)}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={item.row.empresa}>{item.row.empresa}</TableCell>
                  <TableCell className="font-mono text-xs">{formatCnpj(item.row.cnpj)}</TableCell>
                  <TableCell className="font-mono text-xs">{item.row.contract_number || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-xs">
                    {item.row.modelo_contratual || <span className="text-amber-700 dark:text-amber-400 italic">revisar</span>}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {item.row.start_date ? formatDate(item.row.start_date) : '—'} → {item.row.end_date ? formatDate(item.row.end_date) : '—'}
                  </TableCell>
                  <TableCell className="text-xs">{item.row.contract_year ?? '—'}</TableCell>
                  <TableCell>
                    {item.willBeCurrent
                      ? <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Vigente</Badge>
                      : item.row.vencido
                        ? <Badge variant="outline" className="bg-destructive/10 text-destructive">Vencido</Badge>
                        : <span className="text-xs text-muted-foreground">Histórico</span>}
                  </TableCell>
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

function socStatusBadge(status: ImportItem['status']) {
  const map = {
    novo: { label: 'Novo', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    atualizar: { label: 'Atualizar', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    identico: { label: 'Idêntico', className: 'bg-muted text-muted-foreground' },
    erro: { label: 'Erro', className: 'bg-destructive/10 text-destructive' },
  };
  const s = map[status];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

function catStatusBadge(status: CatalogoItem['status'], errorMsg?: string) {
  const map: Record<CatalogoItem['status'], { label: string; className: string }> = {
    novo_cliente: { label: 'Cliente novo', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    contrato_novo: { label: 'Contrato novo', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400' },
    contrato_duplicado: { label: 'Duplicado', className: 'bg-muted text-muted-foreground' },
    erro: { label: 'Erro', className: 'bg-destructive/10 text-destructive' },
  };
  const s = map[status];
  return <Badge variant="outline" className={s.className} title={errorMsg}>{s.label}</Badge>;
}

function formatCnpj(cnpj: string | null): string {
  if (!cnpj || cnpj.length !== 14) return cnpj || '—';
  return `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12)}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
