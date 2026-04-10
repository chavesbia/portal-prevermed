import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileDown, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

const STATUS_LABELS: Record<string, string> = {
  importado: "Importado",
  em_triagem: "Em Triagem",
  aguardando_exames: "Aguard. Exames",
  pronto_assinatura_medica: "Assin. Médica",
  em_escaneamento: "Escaneamento",
  liberado: "Liberado",
  liberado_faturamento: "Faturamento",
  finalizado: "Finalizado",
};

export default function ASORelatorio() {
  const { profile } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [unidade, setUnidade] = useState("all");
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      let q = supabase
        .from("aso_atendimentos")
        .select("*")
        .eq("data_atendimento", date);
      if (unidade !== "all") q = q.ilike("agenda", `%${unidade}%`);

      const { data: rows, error } = await q.order("hora_inicial");
      if (error) throw error;

      const atendimentos = rows || [];
      const stats: Record<string, number> = {};
      atendimentos.forEach((r) => {
        stats[r.status] = (stats[r.status] || 0) + 1;
      });

      const doc = new jsPDF();
      const now = new Date();

      // Header
      doc.setFontSize(16);
      doc.text("Relatório de Liberação de ASOs", 14, 20);
      doc.setFontSize(10);
      doc.text(`Data do atendimento: ${date}`, 14, 28);
      doc.text(`Unidade: ${unidade === "all" ? "Todas" : unidade}`, 14, 34);
      doc.text(`Emitido em: ${now.toLocaleString("pt-BR")}`, 14, 40);
      doc.text(`Emitido por: ${profile?.full_name || "—"}`, 14, 46);

      // Summary
      doc.setFontSize(12);
      doc.text("Resumo", 14, 58);
      doc.setFontSize(10);
      let y = 65;
      doc.text(`Total de atendimentos: ${atendimentos.length}`, 14, y); y += 6;
      Object.entries(STATUS_LABELS).forEach(([k, v]) => {
        const count = stats[k] || 0;
        if (count > 0) {
          doc.text(`${v}: ${count}`, 14, y);
          y += 6;
        }
      });

      // Table header
      y += 6;
      doc.setFontSize(12);
      doc.text("Listagem", 14, y); y += 8;
      doc.setFontSize(8);
      doc.setFont(undefined!, "bold");
      doc.text("Hora", 14, y);
      doc.text("Funcionário", 35, y);
      doc.text("Empresa", 95, y);
      doc.text("Status", 155, y);
      doc.setFont(undefined!, "normal");
      y += 5;

      atendimentos.forEach((a) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(a.hora_inicial || "—", 14, y);
        doc.text((a.funcionario || "—").slice(0, 30), 35, y);
        doc.text((a.empresa || "—").slice(0, 30), 95, y);
        doc.text(STATUS_LABELS[a.status] || a.status, 155, y);
        y += 5;
      });

      doc.save(`relatorio-aso-${date}-${unidade === "all" ? "todas" : unidade.toLowerCase()}.pdf`);
      toast({ title: "PDF gerado com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Gerar Relatório Diário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Data do Atendimento</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Lapa">Lapa</SelectItem>
                  <SelectItem value="Osasco">Osasco</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={generatePDF} disabled={generating} className="gap-2">
                <FileDown className="h-4 w-4" />
                {generating ? "Gerando..." : "Gerar PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
