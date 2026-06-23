import { formatCNPJ, formatCPF, formatCEP, formatBRL, formatDateBR } from './format';
import { numeroPorExtenso, moedaPorExtenso, dataPorExtenso } from './extenso';
import type { ContractPlaceholder } from '@/hooks/useContractPlaceholders';

export interface ContractRenderData {
  cliente: any;
  contrato: any;
  manual?: Record<string, string>;
}

function enderecoCompleto(cliente: any): string {
  if (!cliente) return '';
  const parts = [
    cliente.logradouro,
    cliente.numero,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : (cliente.cidade || cliente.estado),
    cliente.cep ? `CEP ${formatCEP(cliente.cep)}` : null,
  ].filter(Boolean);
  return parts.join(', ');
}

function resolveFonte(fonte: string | null | undefined, ctx: { cliente: any; contrato: any }): any {
  if (!fonte) return null;
  if (fonte === 'cliente.__endereco') return enderecoCompleto(ctx.cliente);
  const [scope, col] = fonte.split('.');
  const src = scope === 'cliente' ? ctx.cliente : scope === 'contrato' ? ctx.contrato : null;
  if (!src) return null;
  return src[col];
}

function applyFormato(raw: any, formato: string): string {
  if (raw == null || raw === '') return '';
  switch (formato) {
    case 'cnpj': return formatCNPJ(String(raw));
    case 'cpf': return formatCPF(String(raw));
    case 'cep': return formatCEP(String(raw));
    case 'moeda': return formatBRL(raw);
    case 'data': return formatDateBR(raw);
    case 'numero': return String(raw);
    case 'percentual': return `${raw}%`;
    case 'extenso_numero': return numeroPorExtenso(Number(raw));
    case 'extenso_moeda': return moedaPorExtenso(Number(raw));
    case 'extenso_data': return dataPorExtenso(raw);
    case 'texto':
    default:
      return String(raw);
  }
}

export function buildPlaceholderValues(
  placeholders: ContractPlaceholder[],
  { cliente, contrato, manual = {} }: ContractRenderData,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const p of placeholders) {
    const raw = resolveFonte(p.fonte, { cliente, contrato });
    let valor = applyFormato(raw, p.formato);
    if (!valor && manual[p.chave]) {
      // Aplica formato sobre valor manual (ex.: usuário digita 1500 para moeda)
      valor = applyFormato(manual[p.chave], p.formato) || manual[p.chave];
    }
    result[p.chave] = valor;
  }
  return result;
}

/** Lista placeholders que não possuem origem mapeada (preenchimento manual no wizard). */
export function placeholdersManuais(placeholders: ContractPlaceholder[]): ContractPlaceholder[] {
  return placeholders.filter(p => !p.fonte);
}

export function renderTemplate(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (m, key) => {
    const v = values[key];
    return v != null && v !== '' ? v : m;
  });
}
