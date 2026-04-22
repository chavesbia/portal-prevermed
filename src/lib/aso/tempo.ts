const STAGE_LABELS: Record<string, string> = {
  importado: "Importado",
  recepcao: "Recepção",
  exames: "Exames Pendentes",
  assinatura: "Assinatura",
  liberacao: "Liberação",
  faturamento: "Faturamento",
};

const STAGE_FIELD_MAP = {
  importado: { enteredAt: "importado_entrada_em", exitedAt: "importado_saida_em" },
  recepcao: { enteredAt: "recepcao_entrada_em", exitedAt: "recepcao_saida_em" },
  exames: { enteredAt: "exames_entrada_em", exitedAt: "exames_saida_em" },
  assinatura: { enteredAt: "assinatura_entrada_em", exitedAt: "assinatura_saida_em" },
  liberacao: { enteredAt: "liberacao_entrada_em", exitedAt: "liberacao_saida_em" },
  faturamento: { enteredAt: "faturamento_entrada_em", exitedAt: "faturamento_saida_em" },
} as const;

export function getAsoStageFromStatus(status: string | null | undefined) {
  switch (status) {
    case "importado":
      return "importado";
    case "em_triagem":
      return "recepcao";
    case "aguardando_exames":
      return "exames";
    case "pronto_assinatura_medica":
      return "assinatura";
    case "em_escaneamento":
    case "liberado":
      return "liberacao";
    case "liberado_faturamento":
      return "faturamento";
    default:
      return null;
  }
}

function parseTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getAsoStageLabel(stage: string | null | undefined) {
  return stage ? STAGE_LABELS[stage] ?? stage : "—";
}

export function getCurrentStageStartedAt(record: Record<string, unknown>) {
  const stage = getAsoStageFromStatus(String(record.status ?? ""));
  if (!stage) return null;
  return parseTimestamp(record[STAGE_FIELD_MAP[stage].enteredAt]);
}

export function getCurrentStageDurationMs(record: Record<string, unknown>, now = new Date()) {
  const startedAt = getCurrentStageStartedAt(record);
  if (!startedAt) return null;
  return Math.max(0, now.getTime() - startedAt.getTime());
}

export function getTotalDurationMs(record: Record<string, unknown>, now = new Date()) {
  const startedAt = parseTimestamp(record.processo_iniciado_em) ?? parseTimestamp(record.importado_entrada_em);
  if (!startedAt) return null;
  const endedAt = parseTimestamp(record.finalizado_em) ?? now;
  return Math.max(0, endedAt.getTime() - startedAt.getTime());
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null) return "—";

  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days} dia${days === 1 ? "" : "s"} ${hours}h` : `${days} dia${days === 1 ? "" : "s"}`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }

  return `${Math.max(minutes, 1)}min`;
}
