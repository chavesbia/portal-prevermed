/**
 * SLA calculation for ASO module using business days.
 * Rule: ASOs with complementary exams must be delivered within 5 business days.
 */

export interface SLAResult {
  diasUteis: number;
  status: "em_dia" | "atencao" | "atrasado";
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function calcDiasUteis(
  startDateStr: string,
  endDate: Date = new Date(),
  feriados: string[] = []
): number {
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDate.toISOString().slice(0, 10) + "T00:00:00");
  if (end <= start) return 0;

  const feriadoSet = new Set(feriados);
  let count = 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1); // start counting next day

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!isWeekend(cursor) && !feriadoSet.has(iso)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function getSLAStatus(diasUteis: number): SLAResult {
  if (diasUteis <= 3) {
    return {
      diasUteis,
      status: "em_dia",
      label: "Em dia",
      color: "text-green-700",
      bgColor: "bg-green-100",
      emoji: "🟢",
    };
  }
  if (diasUteis === 4) {
    return {
      diasUteis,
      status: "atencao",
      label: "Atenção",
      color: "text-yellow-700",
      bgColor: "bg-yellow-100",
      emoji: "🟡",
    };
  }
  return {
    diasUteis,
    status: "atrasado",
    label: "Atrasado",
    color: "text-red-700",
    bgColor: "bg-red-100",
    emoji: "🔴",
  };
}

export function calcSLA(
  dataAtendimento: string,
  feriados: string[] = [],
  endDate?: Date
): SLAResult {
  const dias = calcDiasUteis(dataAtendimento, endDate || new Date(), feriados);
  return getSLAStatus(dias);
}
