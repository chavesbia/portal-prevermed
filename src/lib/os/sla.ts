/**
 * SLA calculation for OS module — Fase 2.
 * Rule: SLA é contabilizado por OS considerando os status
 * "Não iniciado" e "Em andamento". Uma vez "Encerrado", o SLA congela.
 * Cálculo em dias úteis entre data_registro e prazo_acordado.
 */

import { SLAStatus } from '@/types/os';

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Dias úteis entre start (exclusivo) e end (inclusivo). Pode ser negativo. */
export function diasUteisEntre(start: Date, end: Date, feriados: Set<string> = new Set()): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const forward = e >= s;
  const from = forward ? s : e;
  const to = forward ? e : s;
  let count = 0;
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= to) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!isWeekend(cursor) && !feriados.has(iso)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return forward ? count : -count;
}

export interface OSSLAResult {
  status: SLAStatus;
  diasRestantes: number | null; // null quando não há prazo
  diasCorridos: number; // dias úteis desde o registro até hoje (ou encerramento)
  label: string;
}

/**
 * Calcula o SLA de uma OS.
 * - `status_os === 'Encerrado'`: congela usando updated_at como fim.
 * - `prazo_acordado` ausente: retorna 'sem_prazo'.
 * - Faixas:
 *    - atrasado: dias restantes < 0
 *    - atencao: dias restantes >= 0 e <= 3
 *    - em_dia: dias restantes > 3
 */
export function calcOSSLA(params: {
  data_registro: string;
  prazo_acordado: string | null;
  status_os: string;
  updated_at: string;
  feriados?: string[];
}): OSSLAResult {
  const feriadoSet = new Set(params.feriados || []);
  const registro = new Date(params.data_registro + 'T00:00:00');
  const encerrado = params.status_os === 'Encerrado';
  const referencia = encerrado ? new Date(params.updated_at) : new Date();
  const diasCorridos = Math.max(0, diasUteisEntre(registro, referencia, feriadoSet));

  if (!params.prazo_acordado) {
    return {
      status: encerrado ? 'encerrado' : 'sem_prazo',
      diasRestantes: null,
      diasCorridos,
      label: encerrado ? 'Encerrado' : 'Sem prazo',
    };
  }

  const prazo = new Date(params.prazo_acordado + 'T00:00:00');
  const diasRestantes = diasUteisEntre(referencia, prazo, feriadoSet);

  if (encerrado) {
    return { status: 'encerrado', diasRestantes, diasCorridos, label: 'Encerrado' };
  }

  if (diasRestantes < 0) {
    return { status: 'atrasado', diasRestantes, diasCorridos, label: `Atrasado ${Math.abs(diasRestantes)}d` };
  }
  if (diasRestantes <= 3) {
    return { status: 'atencao', diasRestantes, diasCorridos, label: `Atenção ${diasRestantes}d` };
  }
  return { status: 'em_dia', diasRestantes, diasCorridos, label: `Em dia ${diasRestantes}d` };
}
