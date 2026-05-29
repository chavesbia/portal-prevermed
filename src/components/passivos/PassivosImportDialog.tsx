import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { parsePassivosWorkbook, type ParsedPassivo } from '@/lib/passivos/importParser';
import { importPassivos, type ImportSummary } from '@/lib/passivos/importService';
import { brl, formatCnpj } from '@/lib/passivos/utils';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function PassivosImportDialog({ open, onOpenChange }: Props) {
  const [parsed, setParsed] = useState<ParsedPassivo[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const items = parsePassivosWorkbook(buf);
      if (items.length === 0) {
        toast.error('Nenhum parcelamento identificado. Verifique a estrutura da planilha (CNPJ + cabeçalho + linhas).');
        return;
      }
      setParsed(items);
      setStep('preview');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao ler planilha');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const s = await importPassivos(parsed);
      setSummary(s);
      setStep('result');
      qc.invalidateQueries({ queryKey: ['passivos'] });
      toast.success(`${s.criados} criado(s), ${s.atualizados} atualizado(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro na importação');
    } finally {
      setImporting(false);
    }
  };

  const close = (o: boolean) => {
    if (!o) {
      setParsed([]); setSummary(null); setStep('upload');
      if (inputRef.current) inputRef.current.value = '';
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Importar parcelamentos</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecione a planilha Excel no formato Prevermed (blocos por CNPJ + cabeçalho com meses).'}
            {step === 'preview' && `${parsed.length} parcelamento(s) identificado(s). Revise antes de importar.`}
            {step === 'result' && 'Resultado da importação:'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 'upload' && (
            <div className="border-2 border-dashed rounded-lg p-10 text-center space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Formatos aceitos: .xlsx, .xls. A planilha pode conter múltiplas abas; todos os blocos serão lidos.
              </p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              <Button onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Selecionar arquivo</Button>
              <ul className="text-xs text-muted-foreground text-left max-w-lg mx-auto list-disc pl-5 space-y-1">
                <li>Cada bloco inicia com uma linha contendo o <strong>CNPJ</strong> e nome da empresa.</li>
                <li>Cabeçalho deve conter: Número, Tipo, Parcelas (formato <code>54-145</code>), Vencimento, meses (Fev, Mar…), Observações, Link.</li>
                <li>Observações com "<em>2 ATRASADAS</em>" são interpretadas automaticamente.</li>
                <li>Registros existentes (mesmo CNPJ + número de acordo) são <strong>atualizados</strong>, não duplicados.</li>
              </ul>
            </div>
          )}

          {step === 'preview' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Acordo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead className="text-right">Valor mensal</TableHead>
                  <TableHead className="text-center">Venc.</TableHead>
                  <TableHead className="text-right">Atraso</TableHead>
                  <TableHead className="text-right">Meses</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{formatCnpj(p.cnpj)}</TableCell>
                    <TableCell className="font-medium">{p.empresa_nome}</TableCell>
                    <TableCell>{p.numero_acordo}</TableCell>
                    <TableCell><Badge variant="outline">{p.tipo_parcelamento}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{p.parcelas_pagas}/{p.parcelas_totais}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.valor_mensal)}</TableCell>
                    <TableCell className="text-center">{p.dia_vencimento ?? '—'}</TableCell>
                    <TableCell className={`text-right ${p.parcelas_em_atraso >= 3 ? 'text-red-600 font-semibold' : p.parcelas_em_atraso >= 2 ? 'text-amber-600 font-semibold' : ''}`}>
                      {p.parcelas_em_atraso}
                    </TableCell>
                    <TableCell className="text-right">{p.historico.length}</TableCell>
                    <TableCell className="text-xs truncate max-w-[180px]">{p.link_acesso ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {step === 'result' && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{summary.total}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Criados</div><div className="text-2xl font-semibold text-emerald-600">{summary.criados}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Atualizados</div><div className="text-2xl font-semibold text-blue-600">{summary.atualizados}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Histórico</div><div className="text-2xl font-semibold">{summary.historicoCriado}</div></div>
              </div>
              {summary.erros.length > 0 ? (
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-2 text-red-600"><XCircle className="h-4 w-4" /> {summary.erros.length} erro(s)</div>
                  <Table>
                    <TableHeader><TableRow><TableHead>CNPJ</TableHead><TableHead>Acordo</TableHead><TableHead>Erro</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {summary.erros.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{formatCnpj(e.cnpj)}</TableCell>
                          <TableCell>{e.numero_acordo}</TableCell>
                          <TableCell className="text-xs text-red-600">{e.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-sm text-emerald-600 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Importação concluída sem erros.</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'preview' && (
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => { setStep('upload'); setParsed([]); }}>Voltar</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…</> : <><Upload className="h-4 w-4 mr-2" /> Importar {parsed.length} parcelamento(s)</>}
              </Button>
            </div>
          )}
          {step === 'result' && <Button onClick={() => close(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
