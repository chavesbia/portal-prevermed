import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { FilePlus2, FileDown, FileText, Trash2, Eye, Calendar, Building2, Users } from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import {
  useElegiveisFechamento,
  useFechamentoLotes,
  useFechamentoItens,
  useCriarFechamento,
  useExcluirFechamento,
  type FiltroTipoProntuario,
} from "@/hooks/useASOFechamento";
import { useASOEtapaPermissions } from "@/hooks/useASOEtapaPermissions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const TIPO_LABEL: Record<FiltroTipoProntuario, string> = {
  ambos: "Ambos",
  fisico: "Físico",
  digital: "Digital",
};

export default function ASOFechamento() {
  const { canCloseLote, canDeleteLote } = useASOEtapaPermissions();
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date();
  firstDay.setDate(1);
  const firstDayStr = firstDay.toISOString().slice(0, 10);

  // Filtros para previsão de lote
  const [periodoInicial, setPeriodoInicial] = useState(firstDayStr);
  const [periodoFinal, setPeriodoFinal] = useState(today);
  const [tipoProntuario, setTipoProntuario] = useState<FiltroTipoProntuario>("ambos");
  const [observacoes, setObservacoes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filtros = useMemo(
    () => ({ periodo_inicial: periodoInicial, periodo_final: periodoFinal, tipo_prontuario: tipoProntuario }),
    [periodoInicial, periodoFinal, tipoProntuario]
  );

  const { data: elegiveis, isLoading: loadingElegiveis } = useElegiveisFechamento(filtros);
  const { data: lotes } = useFechamentoLotes();
  const criarFechamento = useCriarFechamento();
  const excluirFechamento = useExcluirFechamento();

  // Visualização de lote
  const [loteSelecionado, setLoteSelecionado] = useState<any>(null);
  const [loteParaExcluir, setLoteParaExcluir] = useState<any>(null);
  const { data: itensLote } = useFechamentoItens(loteSelecionado?.id || null);

  const totalElegiveis = elegiveis?.length ?? 0;
  const empresasElegiveis = useMemo(() => {
    const set = new Set<string>();
    (elegiveis || []).forEach((a) => { if (a.empresa) set.add(a.empresa); });
    return set.size;
  }, [elegiveis]);

  const handleFechar = async () => {
    if (!elegiveis || elegiveis.length === 0) return;
    await criarFechamento.mutateAsync({
      filtros,
      atendimentos: elegiveis,
      observacoes: observacoes.trim() || undefined,
    });
    setObservacoes("");
    setConfirmOpen(false);
  };

  // Agrupa itens do lote por empresa
  const itensAgrupados = useMemo(() => {
    if (!itensLote) return [];
    const map = new Map<string, any[]>();
    for (const it of itensLote) {
      const emp = it.empresa || "Sem empresa";
      if (!map.has(emp)) map.set(emp, []);
      map.get(emp)!.push(it);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [itensLote]);

  // Exportação PDF
  const exportarPDF = () => {
    if (!loteSelecionado || !itensLote) return;
    const doc = new jsPDF();
    const lote = loteSelecionado;
    doc.setFontSize(14);
    doc.text(`Fechamento ${lote.numero_lote}`, 14, 16);
    doc.setFontSize(10);
    doc.text(
      `Período: ${formatDateBR(lote.periodo_inicial)} até ${formatDateBR(lote.periodo_final)}  |  Tipo: ${TIPO_LABEL[lote.filtro_tipo_prontuario as FiltroTipoProntuario]}  |  Total: ${lote.total_prontuarios}`,
      14, 22
    );
    doc.text(`Fechado por: ${lote.fechado_por_nome ?? "—"}  |  Em: ${new Date(lote.fechado_em).toLocaleString("pt-BR")}`, 14, 28);

    let y = 36;
    for (const [empresa, items] of itensAgrupados) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text(`Empresa: ${empresa}  (${items.length})`, 14, y);
      doc.setFont(undefined, "normal");
      autoTable(doc, {
        startY: y + 3,
        head: [["Funcionário", "CPF", "Data", "Unidade", "Setor", "Cargo", "Tipo"]],
        body: items.map((it) => [
          it.funcionario || "—",
          it.cpf || "—",
          it.data_atendimento ? formatDateBR(it.data_atendimento) : "—",
          it.unidade || "—",
          it.setor || "—",
          it.cargo || "—",
          it.tipo_prontuario || "—",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    doc.save(`${lote.numero_lote}.pdf`);
  };

  // Exportação Excel
  const exportarExcel = () => {
    if (!loteSelecionado || !itensLote) return;
    const lote = loteSelecionado;
    const rows = itensLote.map((it) => ({
      Empresa: it.empresa || "",
      Funcionário: it.funcionario || "",
      CPF: it.cpf || "",
      Data: it.data_atendimento ? formatDateBR(it.data_atendimento) : "",
      Unidade: it.unidade || "",
      Setor: it.setor || "",
      Cargo: it.cargo || "",
      "Tipo Prontuário": it.tipo_prontuario || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fechamento");
    XLSX.writeFile(wb, `${lote.numero_lote}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Bloco: Novo Fechamento */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <FilePlus2 className="h-4 w-4 text-primary" /> Novo Fechamento de Lote
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione o período e o tipo de prontuário. Apenas prontuários em <b>Faturamento</b> serão incluídos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Período inicial</Label>
            <Input type="date" value={periodoInicial} onChange={(e) => setPeriodoInicial(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Período final</Label>
            <Input type="date" value={periodoFinal} onChange={(e) => setPeriodoFinal(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tipo de Prontuário</Label>
            <Select value={tipoProntuario} onValueChange={(v) => setTipoProntuario(v as FiltroTipoProntuario)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ambos</SelectItem>
                <SelectItem value="fisico">Físico</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!canCloseLote || totalElegiveis === 0 || criarFechamento.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Fechar Lote ({totalElegiveis})
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" /> {loadingElegiveis ? "..." : totalElegiveis} prontuários
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Building2 className="h-3 w-3" /> {empresasElegiveis} empresa(s)
          </Badge>
          {!canCloseLote && (
            <span className="text-xs text-muted-foreground">
              Você não possui permissão para gerar fechamento.
            </span>
          )}
        </div>
      </Card>

      {/* Lista de Lotes */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Lotes de Fechamento
        </h3>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº do Lote</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead>Fechado por</TableHead>
                <TableHead>Fechado em</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lotes || []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.numero_lote}</TableCell>
                  <TableCell className="text-xs">
                    {formatDateBR(l.periodo_inicial)} → {formatDateBR(l.periodo_final)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{TIPO_LABEL[l.filtro_tipo_prontuario as FiltroTipoProntuario]}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{l.total_prontuarios}</TableCell>
                  <TableCell className="text-xs">{l.fechado_por_nome || "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(l.fechado_em).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLoteSelecionado(l)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canDeleteLote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setLoteParaExcluir(l)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!lotes || lotes.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Nenhum lote de fechamento gerado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Diálogo de confirmação */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar fechamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você está prestes a gerar um fechamento contendo{" "}
              <b>{totalElegiveis}</b> prontuário(s) entre <b>{formatDateBR(periodoInicial)}</b> e <b>{formatDateBR(periodoFinal)}</b>{" "}
              ({TIPO_LABEL[tipoProntuario]}).
            </p>
            <p className="text-muted-foreground text-xs">
              Os prontuários serão marcados como <b>Fechado</b> e não poderão ser incluídos em outro lote.
            </p>
            <div>
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: fechamento mensal abril/2026"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleFechar} disabled={criarFechamento.isPending}>
              {criarFechamento.isPending ? "Fechando..." : "Confirmar Fechamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualização do relatório */}
      <Dialog open={!!loteSelecionado} onOpenChange={(o) => !o && setLoteSelecionado(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {loteSelecionado && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Fechamento {loteSelecionado.numero_lote}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-muted-foreground">Período</div>
                  <div className="font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateBR(loteSelecionado.periodo_inicial)} → {formatDateBR(loteSelecionado.periodo_final)}
                  </div>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-muted-foreground">Tipo</div>
                  <div className="font-medium">{TIPO_LABEL[loteSelecionado.filtro_tipo_prontuario as FiltroTipoProntuario]}</div>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-muted-foreground">Total</div>
                  <div className="font-medium">{loteSelecionado.total_prontuarios} prontuário(s)</div>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-muted-foreground">Fechado por</div>
                  <div className="font-medium truncate">{loteSelecionado.fechado_por_nome || "—"}</div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={exportarPDF} className="gap-1">
                  <FileDown className="h-4 w-4" /> Exportar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={exportarExcel} className="gap-1">
                  <FileDown className="h-4 w-4" /> Exportar Excel
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                {itensAgrupados.map(([empresa, items]) => (
                  <div key={empresa}>
                    <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {empresa} <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                    </h4>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Funcionário</TableHead>
                            <TableHead className="text-xs">CPF</TableHead>
                            <TableHead className="text-xs">Data</TableHead>
                            <TableHead className="text-xs">Unidade</TableHead>
                            <TableHead className="text-xs">Setor</TableHead>
                            <TableHead className="text-xs">Cargo</TableHead>
                            <TableHead className="text-xs">Tipo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it) => (
                            <TableRow key={it.id}>
                              <TableCell className="text-xs">{it.funcionario || "—"}</TableCell>
                              <TableCell className="text-xs">{it.cpf || "—"}</TableCell>
                              <TableCell className="text-xs">{it.data_atendimento ? formatDateBR(it.data_atendimento) : "—"}</TableCell>
                              <TableCell className="text-xs">{it.unidade || "—"}</TableCell>
                              <TableCell className="text-xs">{it.setor || "—"}</TableCell>
                              <TableCell className="text-xs">{it.cargo || "—"}</TableCell>
                              <TableCell className="text-xs capitalize">{it.tipo_prontuario || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
                {itensAgrupados.length === 0 && (
                  <p className="text-center text-muted-foreground py-6 text-sm">Sem itens neste lote.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!loteParaExcluir} onOpenChange={(o) => !o && setLoteParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote de fechamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {loteParaExcluir?.total_prontuarios} prontuário(s) serão devolvidos ao status{" "}
              <b>Faturamento</b> e poderão ser incluídos em um novo lote. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (loteParaExcluir) {
                  await excluirFechamento.mutateAsync(loteParaExcluir.id);
                  setLoteParaExcluir(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
