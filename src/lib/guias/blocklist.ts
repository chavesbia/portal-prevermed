/**
 * Prestadores internos das unidades Lapa e Osasco.
 * Guias desses prestadores devem ser ignoradas na importação e na listagem.
 */
export const PRESTADORES_INTERNOS: string[] = [
  "Cdi primitiva - Centro de Diagnóstico Por Imagem",
  "Clinica de Olhos Vedere",
  "Cor & Ar - Centro Cardio Respiratório",
  "DIMEG - Clínica Epitheli - (AVALIAÇÃO OFTALMOLÓGICA)",
  "DIMEG SERVIÇOS MEDICOS HOSPITALARES LTDA (Raio X Osasco)",
  "DMG SERVIÇOS MEDICOS HOSPITALARES LTDA",
  "GS Imagem Medicina Diagnóstica (Raio X Osasco)",
  "Hmo - Hospital Medicina dos Olhos",
  "Laboratório - Osasco (PreverLab)",
  "Laboratório Chromatox (CLT)",
  "Laboratório Chromatox Limitada (CNH)",
  "Medcor Centro Médico Cardiológico de Osasco",
  "MWC MED",
  "Ocupacional - Osasco (PreverMed)",
  "Poli Clinica + Humana",
  "PreverMed - SST",
  "Psicóloga - Fabiana Bordim",
  "Psicóloga - Elaine Cristina Pinho da Silva",
  "Sincomércio - Contribuintes",
  "Sincomércio - Não Contribuintes",
  "Uni Segurança e Medicina do Trabalho",
  "Carezzato - Centro Médico Caetano Carezzato",
  "Fonoaudiologa - Beatriz Lico Lolo",
  "IMADI IMAGEM (GLOBALMED)",
  "Laboratório - Lapa (PreverLab)",
  "Ocupacional - Lapa (PreverMed)",
  "PORTAL MEDIC SEGURANCA E MEDICINA DO TRABALHO LTDA",
  "Psicóloga - Aline Almeida Silva",
  "Psicóloga - Beatriz Vasconcelos da Silva",
  "Psicóloga - Roberta Mantovani",
  "ATENDIMENTO IN LOCO - PREVERMED",
];

const normalizedSet = new Set(PRESTADORES_INTERNOS.map((p) => p.trim().toLowerCase()));

export function isPrestadorInterno(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return normalizedSet.has(nome.trim().toLowerCase());
}

/** Derive origem_agendamento from solicitante_nome */
export function getOrigemAgendamento(solicitanteNome: string | null | undefined): "CLIENTE" | "PREVERMED" {
  if (!solicitanteNome) return "PREVERMED";
  return solicitanteNome.trim().toUpperCase().includes("EMPRESA:") ? "CLIENTE" : "PREVERMED";
}

/** Format text as title case for display (first letter uppercase, rest lowercase per word) */
export function toTitleCase(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .replace(/(?:^|\s|-|\/|\()\S/g, (match) => match.toUpperCase());
}

/** Derive status_prestador from prestador_nome */
export function getStatusPrestador(prestadorNome: string | null | undefined): "SEM PRESTADOR" | "COM PRESTADOR" {
  if (!prestadorNome || prestadorNome.trim() === "") return "SEM PRESTADOR";
  return "COM PRESTADOR";
}

/** Normalize text to uppercase for display fields (not emails/codes) */
export function normalizeUpperCase(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toUpperCase();
}
