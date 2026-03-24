/**
 * Helper functions for guia data processing.
 * The blocklist is now managed dynamically via the prestadores_bloqueados table.
 * Use the usePrestadoresBloqueados hook for checking blocked providers.
 */

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
