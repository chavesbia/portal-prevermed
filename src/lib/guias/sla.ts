import { addDays, isWeekend } from "date-fns";

export type SlaStatus = "EM_DIA" | "ATENCAO" | "ATRASADO";

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

export function getSlaStatus(
  dataBase: string | null,
  atendimentoLancado: string,
  feriados: string[] = []
): SlaStatus {
  if (atendimentoLancado === "SIM") return "EM_DIA";
  if (!dataBase) return "EM_DIA";

  const start = new Date(dataBase);
  const today = new Date();
  const days = calcBusinessDays(start, today, feriados);

  if (days >= 5) return "ATRASADO";
  if (days >= 4) return "ATENCAO";
  return "EM_DIA";
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
