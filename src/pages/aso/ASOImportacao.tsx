import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { parseASOFile, ASOParsedRow } from "@/lib/aso/importParser";
import { executeASOImport } from "@/lib/aso/importService";
import { useASOLotes } from "@/hooks/useASOData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ASOImportacao() {
  const { user, profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ASOParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { data: lotes, refetch } = useASOLotes();

  const displayName = profile?.full_name ?? user?.email ?? "";

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    try {
      const rows = await parseASOFile(f);
      setParsedRows(rows);
      toast({ title: `${rows.length} atendimentos lidos`, description: `Arquivo: ${f.name}` });
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
    if (!user || !file || parsedRows.length === 0) return;
    setImporting(true);
    try {
      const result = await executeASOImport(parsedRows, user.id, displayName, file);
      toast({
        title: "Importação concluída!",
        description: `${result.totalImportados} atendimentos importados (${result.unidade})`,
      });
      setParsedRows([]);
      setFile(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Planilha da Agenda SOC
          </CardTitle>
          <CardDescription>
            Arraste ou selecione o arquivo Excel/CSV extraído do relatório da agenda do SOC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("aso-file-input")?.click()}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">
              {file ? file.name : "Arraste o arquivo aqui ou clique para selecionar"}
            </p>
            {parsedRows.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {parsedRows.length} atendimentos encontrados
              </p>
            )}
            <input
              id="aso-file-input"
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {parsedRows.length > 0 && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-sm">
                  {parsedRows.length} atendimentos prontos para importar
                </Badge>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importando...</>
                  ) : (
                    <><CheckCircle className="h-4 w-4 mr-2" /> Importar Agora</>
                  )}
                </Button>
              </div>

              {/* Preview table */}
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-background">Agenda</TableHead>
                      <TableHead className="sticky top-0 bg-background">Data</TableHead>
                      <TableHead className="sticky top-0 bg-background">Hora</TableHead>
                      <TableHead className="sticky top-0 bg-background">Funcionário</TableHead>
                      <TableHead className="sticky top-0 bg-background">CPF</TableHead>
                      <TableHead className="sticky top-0 bg-background">Empresa</TableHead>
                      <TableHead className="sticky top-0 bg-background">Tipo</TableHead>
                      <TableHead className="sticky top-0 bg-background">Médico</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.agenda || "—"}</TableCell>
                        <TableCell className="text-xs">{r.data_atendimento || "—"}</TableCell>
                        <TableCell className="text-xs">{r.hora_inicial || "—"}</TableCell>
                        <TableCell className="text-xs">{r.funcionario || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.cpf || "—"}</TableCell>
                        <TableCell className="text-xs">{r.empresa || "—"}</TableCell>
                        <TableCell className="text-xs">{r.tipo_compromisso || "—"}</TableCell>
                        <TableCell className="text-xs">{r.medico || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedRows.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Exibindo 50 de {parsedRows.length} registros
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Importações</CardTitle>
        </CardHeader>
        <CardContent>
          {!lotes || lotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma importação realizada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead>Importado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">
                      {format(new Date(l.importado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.unidade}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{l.arquivo_nome || "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{l.total_registros}</TableCell>
                    <TableCell className="text-sm">{l.importado_por_nome || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
