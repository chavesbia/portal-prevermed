export const onlyDigits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');

export const formatCNPJ = (cnpj: string | null | undefined) => {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return cnpj || '';
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const formatCPF = (cpf: string | null | undefined) => {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf || '';
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const formatCEP = (cep: string | null | undefined) => {
  const d = onlyDigits(cep);
  if (d.length !== 8) return cep || '';
  return d.replace(/(\d{5})(\d{3})/, '$1-$2');
};

export const validateCNPJ = (cnpj: string) => {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    let pos = slice - 7;
    for (let i = slice; i >= 1; i--) {
      sum += parseInt(d[slice - i], 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12], 10) && calc(13) === parseInt(d[13], 10);
};

export const validateCPF = (cpf: string) => {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(d[i], 10) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9], 10) && calc(10) === parseInt(d[10], 10);
};

export const formatBRL = (v: number | string | null | undefined) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (n == null || isNaN(n as number)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n as number);
};

export const formatDateBR = (d: string | Date | null | undefined) => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
};
