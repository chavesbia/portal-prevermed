import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { parseFile, ParsedRow } from "@/lib/guias/importParser";
import { analyzeImport, executeImport, type ImportAnalysis, type ImportResult } from "@/lib/guias/importService";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, Clock, AlertTriangle, Ban, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function GuiasImportacao() {
  const { user, profile, isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const displayName = profile?.full_name ?? user?.email ?? "";

  const { data: imports, refetch: refetchImports } = useQuery({
    queryKey: ["guia-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guia_imports")
        .select("*")
        .order("imported_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const lastImport = imports?.[0];

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setAnalysis(null);
    try {
      const rows = await parseFile(f);
      setParsedRows(rows);
      toast({ title: `${rows.length} linhas lidas`, description: `Arquivo: ${f.name}` });
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
      setParsedRows([]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (parsedRows.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await analyzeImport(parsedRows);
      setAnalysis(result);
      toast({ title: "Análise concluída", description: `${result.items.length} guias analisadas, ${result.filteredCount} filtradas (prestadores internos)` });
    } catch (err: any) {
      toast({ title: "Erro na análise", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleDivergent = (code: string) => {
    if (!analysis) return;
    setAnalysis({
      ...analysis,
      items: analysis.items.map((item) =>
        item.guiaCodigo === code ? { ...item, selected: !item.selected } : item
      ),
    });
  };

  const handleImport = async () => {
    if (!file || !user || !analysis) return;
    setImporting(true);
    try {
      const res = await executeImport(analysis, user.id, displayName, file.name, file.size);
      setResult(res);
      refetchImports();
      toast({ title: "Importação concluída!", description: `${res.guiasCriadas} criadas, ${res.guiasAtualizadas} atualizadas, ${res.guiasIgnoradas} ignoradas` });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const novas = analysis?.items.filter((i) => i.status === "nova").length ?? 0;
  const identicas = analysis?.items.filter((i) => i.status === "identica").length ?? 0;
  const autoUpdates = analysis?.items.filter((i) => i.status === "divergente" && i.autoUpdate) ?? [];
  const divergentes = analysis?.items.filter((i) => i.status === "divergente" && !i.autoUpdate) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importação de Guias</h1>
        <p className="text-muted-foreground">Upload do relatório de guias emitidas do SOC</p>
      </div>

      {lastImport && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Última atualização: {format(new Date(lastImport.imported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} por {lastImport.imported_by_name}
        </div>
      )}

      {!isAdmin ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Apenas administradores podem realizar importações.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Upload area */}
          <Card>
            <CardContent className="pt-6">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("guia-file-input")?.click()}
              >
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">Aceita .xlsx e .csv</p>
                <input
                  id="guia-file-input"
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {file && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {parsedRows.length} linhas lidas
                      </p>
                    </div>
                  </div>
                  {!analysis && (
                    <Button onClick={handleAnalyze} disabled={analyzing || parsedRows.length === 0}>
                      {analyzing ? "Analisando..." : "Analisar Arquivo"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis results */}
          {analysis && !result && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{novas}</p>
                    <p className="text-xs text-muted-foreground">Guias Novas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{identicas}</p>
                    <p className="text-xs text-muted-foreground">Idênticas (ignoradas)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{divergentes.length}</p>
                    <p className="text-xs text-muted-foreground">Com Divergências</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-500">{autoUpdates.length}</p>
                    <p className="text-xs text-muted-foreground">Atualização Automática</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-red-500">{analysis.filteredCount}</p>
                    <p className="text-xs text-muted-foreground">Prestadores Internos</p>
                  </CardContent>
                </Card>
              </div>

              {/* Divergent items */}
              {divergentes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Guias com Divergências ({divergentes.length})
                    </CardTitle>
                    <CardDescription>
                      Marque as guias que deseja atualizar com os novos dados. Desmarcadas serão ignoradas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-auto">
                      {divergentes.map((item) => (
                        <div key={item.guiaCodigo} className="border rounded-lg p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleDivergent(item.guiaCodigo)}
                            />
                            <span className="font-mono text-sm font-medium">{item.guiaCodigo}</span>
                            <Badge variant={item.selected ? "default" : "secondary"} className="text-xs">
                              {item.selected ? "Atualizar" : "Ignorar"}
                            </Badge>
                          </div>
                          <div className="ml-8 space-y-1">
                            {item.diffs.map((d, i) => (
                              <div key={i} className="text-xs flex items-center gap-2">
                                <span className="text-muted-foreground w-32 shrink-0">{d.campo}:</span>
                                <span className="line-through text-red-500">{d.antigo || "(vazio)"}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-green-600 font-medium">{d.novo || "(vazio)"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setAnalysis(null); setFile(null); setParsedRows([]); }}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} disabled={importing} size="lg">
                  {importing ? "Importando..." : "Confirmar Importação"}
                </Button>
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <h3 className="font-semibold text-lg">Importação Concluída</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                  <div><p className="text-2xl font-bold">{result.totalRows}</p><p className="text-xs text-muted-foreground">Linhas processadas</p></div>
                  <div><p className="text-2xl font-bold">{result.guiasCriadas}</p><p className="text-xs text-muted-foreground">Guias criadas</p></div>
                  <div><p className="text-2xl font-bold">{result.guiasAtualizadas}</p><p className="text-xs text-muted-foreground">Guias atualizadas</p></div>
                  <div><p className="text-2xl font-bold">{result.guiasIgnoradas}</p><p className="text-xs text-muted-foreground">Guias ignoradas</p></div>
                  <div><p className="text-2xl font-bold">{result.examesCriados}</p><p className="text-xs text-muted-foreground">Exames criados</p></div>
                  <div><p className="text-2xl font-bold">{result.examesAtualizados}</p><p className="text-xs text-muted-foreground">Exames atualizados</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Import history */}
      {imports && imports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Importações</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Linhas</TableHead>
                  <TableHead>Guias</TableHead>
                  <TableHead>Exames</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell className="text-xs">{format(new Date(imp.imported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell className="text-xs">{imp.imported_by_name}</TableCell>
                    <TableCell className="text-xs max-w-40 truncate">{imp.file_name}</TableCell>
                    <TableCell className="text-xs">{imp.total_rows_lidas}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary" className="text-xs">
                        {(imp.total_guias_criadas ?? 0) + (imp.total_guias_atualizadas ?? 0)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary" className="text-xs">
                        {(imp.total_exames_criados ?? 0) + (imp.total_exames_atualizados ?? 0)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
