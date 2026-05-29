import * as XLSX from 'xlsx';

// Layout fixo da planilha Prevermed (linha-a-linha):
// A: CNPJ | B: Razão Social | C: N° Parcelamento/Acordo | D: Tipo
// E: Parcelas (formato "54-145") | F: Vencimento (dia)
// G..: meses do ano corrente de controle (Fevereiro, Março, Abril, Maio, ...)
// Antes de "Observações" | Penúltima: Observações | Última: Link de acesso
//
// O controle iniciou em Fevereiro/2026, portanto o histórico mensal usa ano = 2026.

const ANO_CONTROLE = 2026;

const MESES_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

function norm(s: any): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function onlyDigits(s: any): string { return String(s ?? '').replace(/\D/g, ''); }
function isCnpj(s: any): boolean { return onlyDigits(s).length === 14; }
function isUrl(s: any): boolean { return /^https?:\/\//i.test(String(s ?? '').trim()); }

function parseParcelas(raw: any): { pagas: number; totais: number } | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/(\d+)\s*[-\/]\s*(\d+)/);
  if (m) return { pagas: parseInt(m[1], 10), totais: parseInt(m[2], 10) };
  return null;
}

function parseAtrasadas(raw: any): number {
  const s = String(raw ?? '');
  const m = s.match(/(\d+)\s*atras/i);
  return m ? parseInt(m[1], 10) : 0;
}

function parseDia(raw: any): number | null {
  if (raw == null || raw === '') return null;
  const n = parseInt(String(raw).match(/\d{1,2}/)?.[0] ?? '', 10);
  return !isNaN(n) && n >= 1 && n <= 31 ? n : null;
}

function parseNumber(raw: any): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  let s = String(raw).trim();
  if (!s || s === '—' || s === '-') return 0;
  s = s.replace(/R\$\s?/i, '').replace(/\s/g, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3 && parts.slice(0, -1).every(p => p.length <= 3)) {
      s = s.replace(/\./g, '');
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export interface ParsedHistorico {
  ano: number;
  mes: number;
  valor: number;
}

export interface ParsedPassivo {
  cnpj: string;
  empresa_nome: string;
  numero_acordo: string;
  tipo_parcelamento: string;
  parcelas_pagas: number;
  parcelas_totais: number;
  valor_mensal: number;
  dia_vencimento: number | null;
  parcelas_em_atraso: number;
  observacoes: string | null;
  link_acesso: string | null;
  historico: ParsedHistorico[];
}

interface ColMap {
  cnpj: number;
  empresa: number;
  numero: number;
  tipo: number;
  parcelas: number;
  vencimento: number;
  observacoes: number;
  link: number;
  meses: Array<{ col: number; mes: number }>;
}

function detectColumns(header: any[]): ColMap | null {
  const cols: Partial<ColMap> & { meses: ColMap['meses'] } = { meses: [] };
  for (let i = 0; i < header.length; i++) {
    const n = norm(header[i]);
    if (!n) continue;
    if (cols.cnpj == null && /cnpj/.test(n)) { cols.cnpj = i; continue; }
    if (cols.empresa == null && /(razao|empresa|nome)/.test(n)) { cols.empresa = i; continue; }
    if (cols.numero == null && /(parcelamento|acordo|numero|n[°ºo°])/.test(n) && !/parcelas/.test(n)) { cols.numero = i; continue; }
    if (cols.tipo == null && /^tipo/.test(n)) { cols.tipo = i; continue; }
    if (cols.parcelas == null && /parcelas/.test(n)) { cols.parcelas = i; continue; }
    if (cols.vencimento == null && /vencimento|venc\b/.test(n)) { cols.vencimento = i; continue; }
    if (cols.observacoes == null && /observ/.test(n)) { cols.observacoes = i; continue; }
    if (cols.link == null && /(link|acesso|url)/.test(n)) { cols.link = i; continue; }
    // mês isolado
    const token = n.split(/[\s\/_-]+/)[0];
    if (token in MESES_PT) cols.meses.push({ col: i, mes: MESES_PT[token] });
  }
  if (cols.cnpj == null || cols.numero == null || cols.parcelas == null) return null;
  // valores padrão
  if (cols.empresa == null) cols.empresa = cols.cnpj + 1;
  if (cols.tipo == null) cols.tipo = cols.numero + 1;
  if (cols.vencimento == null) cols.vencimento = cols.parcelas + 1;
  if (cols.observacoes == null) cols.observacoes = header.length - 2;
  if (cols.link == null) cols.link = header.length - 1;
  return cols as ColMap;
}

export function parsePassivosWorkbook(buffer: ArrayBuffer): ParsedPassivo[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const results: ParsedPassivo[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    if (rows.length < 2) continue;

    // localizar linha de cabeçalho (primeira linha com "CNPJ" + "Parcelas")
    let headerIdx = -1;
    let cols: ColMap | null = null;
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const c = detectColumns(rows[r]);
      if (c) { headerIdx = r; cols = c; break; }
    }
    if (!cols || headerIdx < 0) continue;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every(c => String(c ?? '').trim() === '')) continue;

      const cnpjRaw = row[cols.cnpj];
      if (!isCnpj(cnpjRaw)) continue;

      const cnpj = onlyDigits(cnpjRaw);
      const empresa = String(row[cols.empresa] ?? '').trim() || '—';
      const numero = String(row[cols.numero] ?? '').trim();
      const tipo = (String(row[cols.tipo] ?? '').trim() || 'OUTROS').toUpperCase().slice(0, 60);
      const p = parseParcelas(row[cols.parcelas]);
      const dia = parseDia(row[cols.vencimento]);
      const obs = String(row[cols.observacoes] ?? '').trim();
      const linkRaw = String(row[cols.link] ?? '').trim();
      const link = isUrl(linkRaw) ? linkRaw : null;

      // histórico mensal — apenas valores > 0
      const historico: ParsedHistorico[] = [];
      for (const m of cols.meses) {
        const v = parseNumber(row[m.col]);
        if (v > 0) historico.push({ ano: ANO_CONTROLE, mes: m.mes, valor: v });
      }
      // valor mensal de referência = último mês com valor (mais recente)
      const valorMensal = historico.length ? historico[historico.length - 1].valor : 0;

      if (!numero) continue;

      results.push({
        cnpj,
        empresa_nome: empresa,
        numero_acordo: numero,
        tipo_parcelamento: tipo,
        parcelas_pagas: p?.pagas ?? 0,
        parcelas_totais: p?.totais ?? 1,
        valor_mensal: valorMensal,
        dia_vencimento: dia,
        parcelas_em_atraso: parseAtrasadas(obs),
        observacoes: obs || null,
        link_acesso: link,
        historico,
      });
    }
  }

  return results;
}
