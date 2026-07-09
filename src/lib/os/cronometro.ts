// Utilitário simples para calcular e formatar tempo decorrido em OS/Serviços
import { parseISO } from 'date-fns';

export function elapsedMs(startISO: string | null | undefined, endISO?: string | null): number | null {
  if (!startISO) return null;
  const start = parseISO(startISO).getTime();
  const end = endISO ? parseISO(endISO).getTime() : Date.now();
  const diff = end - start;
  return diff >= 0 ? diff : 0;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && mins) parts.push(`${mins}min`);
  if (!parts.length) parts.push('<1min');
  return parts.join(' ');
}
