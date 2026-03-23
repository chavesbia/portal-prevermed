import { addDays, isWeekend } from "date-fns";

export type SlaStatus = "EM_DIA" | "ATENCAO" | "ATRASADO";
export type GuiaStatusType = "PENDENTE" | "INICIADA" | "EM_ANDAMENTO" | "FINALIZADA";

export function calcBusinessDays(startDate: Date, endDate: Date, feriados: string[] = []): number {
  let count = 0;
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    current = addDays(current, 1);
    if (!isWeekend(current) && !feriados.includes(current.toISOString().split("T")[0])) {
      count++;
    }
  }
  return count;
}

/**
 * Calculate live SLA based on business days elapsed.
 * Used when atendimento has NOT been lançado yet.
 */
export function calcLiveSla(
  dataBase: string | null,
  feriados: string[] = []
): SlaStatus {
  if (!dataBase) return "EM_DIA";
  const start = new Date(dataBase);
  const today = new Date();
  const days = calcBusinessDays(start, today, feriados);
  if (days >= 5) return "ATRASADO";
  if (days >= 4) return "ATENCAO";
  return "EM_DIA";
}

/**
 * Get the effective SLA for a guia.
 * If sla_final is frozen (atendimento was lançado), use that.
 * Otherwise calculate live SLA.
 */
export function getSlaStatus(
  dataBase: string | null,
  atendimentoLancado: string,
  feriados: string[] = [],
  slaFinal?: string | null
): SlaStatus {
  // If SLA was frozen, always use it
  if (slaFinal && ["EM_DIA", "ATENCAO", "ATRASADO"].includes(slaFinal)) {
    return slaFinal as SlaStatus;
  }
  // If atendimento lançado but no frozen SLA (legacy data), calculate from today
  if (atendimentoLancado === "SIM") {
    return calcLiveSla(dataBase, feriados);
  }
  // Live calculation
  return calcLiveSla(dataBase, feriados);
}

/**
 * Calculate the SLA to freeze at the moment atendimento is being lançado.
 */
export function calcSlaToFreeze(
  dataBase: string | null,
  feriados: string[] = []
): SlaStatus {
  return calcLiveSla(dataBase, feriados);
}

export function getSlaColor(status: SlaStatus) {
  switch (status) {
    case "EM_DIA": return "bg-green-500 text-white";
    case "ATENCAO": return "bg-yellow-500 text-white";
    case "ATRASADO": return "bg-destructive text-destructive-foreground";
  }
}

export function getSlaLabel(status: SlaStatus) {
  switch (status) {
    case "EM_DIA": return "Em Dia";
    case "ATENCAO": return "Atenção";
    case "ATRASADO": return "Atrasado";
  }
}

/**
 * Derive the operational "Status da Guia" from the 3 gestão fields.
 */
export function getGuiaStatus(
  compareceu: string,
  atendimentoLancado: string,
  asoAnexado: string
): GuiaStatusType {
  // Finalizada: não compareceu
  if (compareceu === "NAO_COMPARECEU") return "FINALIZADA";

  const compOk = compareceu === "COMPARECEU" || compareceu === "PARCIAL";
  const atendOk = atendimentoLancado === "SIM";
  const asoOk = asoAnexado === "SIM";

  // Finalizada: compareceu + atendimento lançado + ASO anexado
  if (compOk && atendOk && asoOk) return "FINALIZADA";

  // Em andamento: compareceu + atendimento lançado, mas ASO pendente
  if (compOk && atendOk) return "EM_ANDAMENTO";

  // Iniciada: compareceu or parcial
  if (compOk) return "INICIADA";

  // Pendente: nothing filled
  return "PENDENTE";
}

export function getGuiaStatusColor(status: GuiaStatusType) {
  switch (status) {
    case "PENDENTE": return "bg-muted text-muted-foreground";
    case "INICIADA": return "bg-blue-500 text-white";
    case "EM_ANDAMENTO": return "bg-orange-500 text-white";
    case "FINALIZADA": return "bg-green-600 text-white";
  }
}

export function getGuiaStatusLabel(status: GuiaStatusType) {
  switch (status) {
    case "PENDENTE": return "Pendente";
    case "INICIADA": return "Iniciada";
    case "EM_ANDAMENTO": return "Em Andamento";
    case "FINALIZADA": return "Finalizada";
  }
}
