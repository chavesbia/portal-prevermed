export type PassivoStatus = 'em_dia' | 'atrasado' | 'encerrado' | 'novo_acordo' | 'suspenso';

export const STATUS_LABELS: Record<PassivoStatus, string> = {
  em_dia: 'Em dia',
  atrasado: 'Atrasado',
  encerrado: 'Encerrado',
  novo_acordo: 'Novo acordo',
  suspenso: 'Suspenso',
};

export const STATUS_BADGE: Record<PassivoStatus, string> = {
  em_dia: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  atrasado: 'bg-red-100 text-red-800 border-red-200',
  encerrado: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  novo_acordo: 'bg-blue-100 text-blue-800 border-blue-200',
  suspenso: 'bg-amber-100 text-amber-800 border-amber-200',
};

export const TIPOS_PARCELAMENTO = [
  'PGFN', 'DARF', 'DAS', 'PPI', 'TDM', 'ISS-SIMPLES', 'INSS', 'OUTROS',
] as const;

export function formatCnpj(cnpj: string): string {
  const d = (cnpj || '').replace(/\D/g, '').padStart(14, '0').slice(-14);
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}

export function onlyDigits(s: string): string {
  return (s || '').replace(/\D/g, '');
}

export function brl(v: number | null | undefined): string {
  return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ===== Análise de risco =====
// Limiares configuráveis futuramente via painel administrativo
export const RISK_THRESHOLDS = {
  atencao: 2,       // >= 2 parcelas em atraso → amarelo
  critico: 3,       // >= 3 parcelas em atraso → vermelho
  cancelamento: 3,  // risco de cancelamento do parcelamento
} as const;

export type RiskLevel = 'ok' | 'atencao' | 'critico';

export function getRiskLevel(parcelasEmAtraso: number): RiskLevel {
  if (parcelasEmAtraso >= RISK_THRESHOLDS.critico) return 'critico';
  if (parcelasEmAtraso >= RISK_THRESHOLDS.atencao) return 'atencao';
  return 'ok';
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  ok: 'Regular',
  atencao: 'Atenção',
  critico: 'Crítico',
};

export const RISK_ROW_CLASS: Record<RiskLevel, string> = {
  ok: '',
  atencao: 'bg-amber-50 hover:bg-amber-100/70',
  critico: 'bg-red-50 hover:bg-red-100/70',
};

export const RISK_BADGE: Record<RiskLevel, string> = {
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  atencao: 'bg-amber-100 text-amber-900 border-amber-300',
  critico: 'bg-red-100 text-red-800 border-red-300',
};
