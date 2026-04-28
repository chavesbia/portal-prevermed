export const SUBGROUP_OPTIONS = [
  'Gestão Ocupacional',
  'Gestão Ocupacional com eSocial',
  'Parceiras com prontuário',
  'Parceiras via SOCNET',
  'Pontual - exames',
  'Por Uso',
  'Por Uso com eSocial',
  'Sem subgrupo',
] as const;

export const RISK_GRADES = ['1', '2', '3', '4'] as const;

export const RISK_GRADE_NOT_INFORMED_LABEL = 'Não Informado';

/**
 * Normaliza grau de risco para exibição.
 * Grau 0 ou vazio é tratado como "Não Informado" (NR-4 só admite 1-4).
 */
export function formatRiskGrade(val: string | number | null | undefined): string {
  if (val == null) return RISK_GRADE_NOT_INFORMED_LABEL;
  const s = String(val).trim();
  if (!s || s === '0') return RISK_GRADE_NOT_INFORMED_LABEL;
  return s;
}

/** Considera o valor como informado (1-4)? */
export function isValidRiskGrade(val: string | number | null | undefined): boolean {
  if (val == null) return false;
  const s = String(val).trim();
  return s === '1' || s === '2' || s === '3' || s === '4';
}

export const STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;
