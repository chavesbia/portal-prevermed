// Exames complementares com liberação imediata (no mesmo dia, controlados individualmente)
const EXAMES_LIBERACAO_IMEDIATA = [
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
  if (EXAMES_LIBERACAO_IMEDIATA.some(e => norm.includes(normalizeExameName(e)))) return "imediato";
  return "complementar";
}

/** Verifica se o exame tem liberação imediata (Audiometria, Acuidade Visual) */
export function isLiberacaoImediata(nomeExame: string): boolean {
  const norm = normalizeExameName(nomeExame);
  return EXAMES_LIBERACAO_IMEDIATA.some(e => norm.includes(normalizeExameName(e)));
}

/** Normaliza o nome do exame para exibição */
export function normalizeExameNome(nome: string): string {
  const norm = normalizeExameName(nome);
  if (EXAME_CLINICO_ALIASES.some(e => norm.includes(normalizeExameName(e)))) {
    return "Exame Clínico";
  }
  return nome.trim();
}

/**
 * Verifica se o prontuário pode ser liberado diretamente pela recepção
 * (sem passar pela enfermagem).
 * Condição: apenas Exame Clínico e/ou exames de liberação imediata (Audiometria, Acuidade Visual).
 * Nenhum outro exame complementar.
 */
export function podeRecepcaoLiberar(examesNomes: string[]): boolean {
  return examesNomes.every(nome => {
    const tipo = classifyExame(nome);
    return tipo === "clinico" || tipo === "imediato";
  });
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
