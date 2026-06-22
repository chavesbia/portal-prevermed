import jsPDF from "jspdf";
import { CLASS_LABELS, type FbAvaliacao, type FbNota, type FbAcao, type FbStatusColab, type FbCompetencia } from "@/hooks/useFeedback";

interface Args {
  avaliacao: FbAvaliacao;
  notas: FbNota[];
  feedforward: FbAcao[];
  pdi: FbAcao[];
  colaborador: FbStatusColab;
  competencias: FbCompetencia[];
}

const BRAND = { r: 0, g: 86, b: 145 }; // PreverMed blue
const MARGIN = 15;
const PAGE_W = 210;

export function generateFeedbackPDF({ avaliacao, notas, feedforward, pdi, colaborador, competencias }: Args) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // Header bar
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, PAGE_W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PreverMed — Avaliação de Desempenho", MARGIN, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, PAGE_W - MARGIN, 14, { align: "right" });

  y = 30;
  doc.setTextColor(20, 20, 20);

  // Colab info block
  const info: [string, string][] = [
    ["Colaborador", colaborador.nome ?? "—"],
    ["Matrícula", colaborador.matricula ?? "—"],
    ["Cargo", colaborador.cargo ?? "—"],
    ["Setor (lotação)", colaborador.setor_nome ?? "—"],
    ["Líder direto", colaborador.lider_nome ?? "—"],
    ["Gestor direto", colaborador.gestor_nome ?? "—"],
    ["Data da avaliação", new Date(avaliacao.data_avaliacao).toLocaleDateString("pt-BR")],
    ["Próximo feedback", avaliacao.data_proximo_feedback ? new Date(avaliacao.data_proximo_feedback).toLocaleDateString("pt-BR") : "—"],
  ];
  doc.setFontSize(10);
  info.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * 90;
    const yy = y + row * 7;
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, x, yy);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), x + 35, yy);
  });
  y += Math.ceil(info.length / 2) * 7 + 4;

  // Score
  if (avaliacao.pontuacao_total != null && avaliacao.classificacao) {
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.roundedRect(MARGIN, y, PAGE_W - 2 * MARGIN, 14, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      `Pontuação total: ${avaliacao.pontuacao_total}  ·  Classificação: ${CLASS_LABELS[avaliacao.classificacao]}`,
      PAGE_W / 2, y + 9, { align: "center" },
    );
    doc.setTextColor(20, 20, 20);
    y += 18;
  }

  // Competencies table
  y = section(doc, y, "Competências Avaliadas");
  const compMap = new Map(competencias.map((c) => [c.id, c]));
  notas
    .slice()
    .sort((a, b) => (compMap.get(a.competencia_id)?.ordem ?? 0) - (compMap.get(b.competencia_id)?.ordem ?? 0))
    .forEach((n) => {
      const c = compMap.get(n.competencia_id);
      y = ensureSpace(doc, y, 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`${c?.ordem ?? "·"}. ${c?.nome ?? "—"}`, MARGIN, y);
      doc.setFont("helvetica", "bold");
      doc.text(`Nota: ${n.nota}/4`, PAGE_W - MARGIN, y, { align: "right" });
      y += 6;
    });

  // Qualitative
  y = paragraph(doc, y, "Atividades Realizadas", avaliacao.atividades);
  y = paragraph(doc, y, "Pontos Positivos", avaliacao.pontos_positivos);
  y = paragraph(doc, y, "Pontos de Melhora", avaliacao.pontos_melhora);
  y = paragraph(doc, y, "Ações de Melhoria", avaliacao.acoes_melhoria);
  y = paragraph(doc, y, "Observações do Gestor", avaliacao.observacoes);

  // Feedforward
  if (feedforward.length) {
    y = section(doc, y, "Combinados para o Próximo Ciclo (Feedforward)");
    feedforward.forEach((f) => { y = acaoLinha(doc, y, f); });
  }

  // PDI
  if (pdi.length) {
    y = section(doc, y, "Plano de Desenvolvimento Individual (PDI)");
    pdi.forEach((p) => { y = acaoLinha(doc, y, p); });
  }

  // Signature lines
  y = ensureSpace(doc, y, 30);
  y += 12;
  const colW = (PAGE_W - 2 * MARGIN - 10) / 2;
  doc.line(MARGIN, y, MARGIN + colW, y);
  doc.line(MARGIN + colW + 10, y, PAGE_W - MARGIN, y);
  doc.setFontSize(9);
  doc.text("Colaborador", MARGIN + colW / 2, y + 5, { align: "center" });
  doc.text("Gestor / RH", MARGIN + colW + 10 + colW / 2, y + 5, { align: "center" });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`PreverMed · Avaliação de Desempenho · Pág. ${i}/${pageCount}`, PAGE_W / 2, 290, { align: "center" });
  }

  const nome = (colaborador.nome ?? "colaborador").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`avaliacao_${nome}_${avaliacao.data_avaliacao}.pdf`);
}

function section(doc: jsPDF, y: number, title: string) {
  y = ensureSpace(doc, y, 12);
  y += 2;
  doc.setFillColor(235, 240, 248);
  doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, 7, "F");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, MARGIN + 2, y + 5);
  doc.setTextColor(20, 20, 20);
  return y + 10;
}

function paragraph(doc: jsPDF, y: number, title: string, text: string | null | undefined) {
  if (!text?.trim()) return y;
  y = section(doc, y, title);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, PAGE_W - 2 * MARGIN);
  lines.forEach((ln: string) => {
    y = ensureSpace(doc, y, 5);
    doc.text(ln, MARGIN, y);
    y += 5;
  });
  return y + 2;
}

function acaoLinha(doc: jsPDF, y: number, a: FbAcao) {
  y = ensureSpace(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("• ", MARGIN, y);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(a.acao, PAGE_W - 2 * MARGIN - 5);
  lines.forEach((ln: string, i: number) => {
    if (i > 0) y = ensureSpace(doc, y, 5);
    doc.text(ln, MARGIN + 4, y);
    y += 5;
  });
  doc.setFontSize(9);
  doc.setTextColor(90);
  const meta = [
    a.responsavel ? `Resp.: ${a.responsavel}` : null,
    a.prazo ? `Prazo: ${new Date(a.prazo).toLocaleDateString("pt-BR")}` : null,
    `Status: ${a.status}`,
  ].filter(Boolean).join("   ");
  doc.text(meta, MARGIN + 4, y);
  doc.setTextColor(20, 20, 20);
  return y + 6;
}

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  if (y + needed > 280) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}
