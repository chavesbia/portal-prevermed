import { onlyDigits, validateCPF as _validate } from './format';

export const maskCPF = (raw: string | null | undefined): string => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export const isValidCPF = (raw: string | null | undefined): boolean => {
  const d = onlyDigits(raw);
  if (d.length !== 11) return false;
  return _validate(d);
};
