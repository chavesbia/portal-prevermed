// Exames com liberação imediata (no mesmo dia, mas controlados individualmente)
const EXAMES_IMEDIATOS = [
  "acuidade visual",
  "audiometria",
];

// Exame Clínico - tratamento especial (status inicial: realizado)
const EXAME_CLINICO_ALIASES = [
  "exame clinico",
  "exame clínico",
  "avaliacao clinica ocupacional",
  "avaliação clínica ocupacional",
  "avaliação clinica ocupacional",
  "avaliacao clínica ocupacional",
];

function normalizeExameName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export type ExameTipo = "imediato" | "complementar" | "clinico";

export function classifyExame(nomeExame: string): ExameTipo {
  const norm = normalizeExameName(nomeExame);
  if (EXAME_CLINICO_ALIASES.some(e => norm.includes(normalizeExameName(e)))) return "clinico";
  if (EXAMES_IMEDIATOS.some(e => norm.includes(normalizeExameName(e)))) return "imediato";
  return "complementar";
}

/** Normaliza o nome do exame para exibição */
export function normalizeExameNome(nome: string): string {
  const norm = normalizeExameName(nome);
  if (EXAME_CLINICO_ALIASES.some(e => norm.includes(normalizeExameName(e)))) {
    return "Exame Clínico";
  }
  return nome.trim();
}

export function parseExamesTexto(examesTexto: string | null): { nome_exame: string; tipo: ExameTipo; status_inicial: string }[] {
  if (!examesTexto) return [];
  
  const parts = examesTexto
    .split(/[\n;]+/)
    .flatMap(part => {
      if (part.includes(",") && !part.includes("(")) {
        return part.split(",");
      }
      return [part];
    })
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return parts.map(nome => {
    const tipo = classifyExame(nome);
    const nomeNormalizado = normalizeExameNome(nome);
    return {
      nome_exame: nomeNormalizado,
      tipo: tipo === "clinico" ? "imediato" as const : tipo, // DB stores as imediato/complementar
      status_inicial: tipo === "clinico" ? "realizado" : "pendente",
    };
  });
}
