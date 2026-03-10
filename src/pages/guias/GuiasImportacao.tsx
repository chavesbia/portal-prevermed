import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { parseFile, ParsedRow } from "@/lib/guias/importParser";
import { executeImport, ImportResult } from "@/lib/guias/importService";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function GuiasImportacao() {
  const { user, profile, isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
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

  const handleImport = async () => {
    if (!file || !user) return;
    setImporting(true);
    try {
      const res = await executeImport(parsedRows, user.id, displayName, file.name, file.size);
      setResult(res);
      refetchImports();
      toast({ title: "Importação concluída!", description: `${res.guiasCriadas} guias criadas, ${res.guiasAtualizadas} atualizadas` });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const previewRows = parsedRows.slice(0, 20);
  const uniqueGuias = new Set(parsedRows.map((r) => r.guia_codigo)).size;

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
                <div className="mt-4 flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {parsedRows.length} linhas · {uniqueGuias} guias únicas
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {previewRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Prévia ({Math.min(20, parsedRows.length)} de {parsedRows.length} linhas)</CardTitle>
                <CardDescription>{uniqueGuias} guias únicas identificadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Data Guia</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Prestador</TableHead>
                        <TableHead>Exame</TableHead>
                        <TableHead>Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{row.guia_codigo}</TableCell>
                          <TableCell className="text-xs">{row.data_guia ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-32 truncate">{row.empresa_nome ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-32 truncate">{row.funcionario_nome ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-32 truncate">{row.prestador_nome ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-32 truncate">{row.exame_nome ?? "—"}</TableCell>
                          <TableCell className="text-xs">{row.tipo_exame ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={handleImport} disabled={importing} size="lg">
                    {importing ? "Importando..." : "Confirmar Importação"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <h3 className="font-semibold text-lg">Importação Concluída</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div><p className="text-2xl font-bold">{result.totalRows}</p><p className="text-xs text-muted-foreground">Linhas lidas</p></div>
                  <div><p className="text-2xl font-bold">{result.guiasCriadas}</p><p className="text-xs text-muted-foreground">Guias criadas</p></div>
                  <div><p className="text-2xl font-bold">{result.guiasAtualizadas}</p><p className="text-xs text-muted-foreground">Guias atualizadas</p></div>
                  <div><p className="text-2xl font-bold">{result.examesCriados}</p><p className="text-xs text-muted-foreground">Exames criados</p></div>
                  <div><p className="text-2xl font-bold">{result.examesAtualizados}</p><p className="text-xs text-muted-foreground">Exames atualizados</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

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
