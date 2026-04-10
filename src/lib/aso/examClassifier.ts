// Exames that are performed and have results immediately on-site
const EXAMES_IMEDIATOS = [
  "exame clinico",
  "exame clínico",
  "acuidade visual",
  "audiometria",
];

function normalizeExameName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function classifyExame(nomeExame: string): "imediato" | "complementar" {
  const norm = normalizeExameName(nomeExame);
  return EXAMES_IMEDIATOS.some(e => norm.includes(e)) ? "imediato" : "complementar";
}

export function parseExamesTexto(examesTexto: string | null): { nome_exame: string; tipo: "imediato" | "complementar" }[] {
  if (!examesTexto) return [];
  
  // Split by newline, semicolon, or comma (but not commas inside parentheses)
  const parts = examesTexto
    .split(/[\n;]+/)
    .flatMap(part => {
      // If no newlines/semicolons produced splits, try comma but preserve parenthetical content
      if (part.includes(",") && !part.includes("(")) {
        return part.split(",");
      }
      return [part];
    })
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return parts.map(nome => ({
    nome_exame: nome,
    tipo: classifyExame(nome),
  }));
}
