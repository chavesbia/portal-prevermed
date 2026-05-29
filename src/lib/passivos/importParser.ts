import * as XLSX from 'xlsx';

const MESES_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

function norm(s: any): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function onlyDigits(s: any): string { return String(s ?? '').replace(/\D/g, ''); }

function isCnpj(s: any): boolean {
  return onlyDigits(s).length === 14;
}

function parseParcelas(raw: any): { pagas: number; totais: number } | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/(\d+)\s*[-\/de]+\s*(\d+)/i);
  if (m) return { pagas: parseInt(m[1], 10), totais: parseInt(m[2], 10) };
  const n = parseInt(s, 10);
  if (!isNaN(n)) return { pagas: 0, totais: n };
  return null;
}

function parseAtrasadas(raw: any): number {
  const s = String(raw ?? '');
  const m = s.match(/(\d+)\s*atras/i);
  return m ? parseInt(m[1], 10) : 0;
}

function parseDia(raw: any): number | null {
  const s = String(raw ?? '');
  const m = s.match(/(\d{1,2})/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  return d >= 1 && d <= 31 ? d : null;
}

function parseNumber(raw: any): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  let s = String(raw).trim();
  if (!s) return 0;
  s = s.replace(/R\$\s?/i, '').replace(/\s/g, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // último símbolo é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.'); // pt-BR: 1.304,60
    } else {
      s = s.replace(/,/g, ''); // en-US: 1,304.60
    }
  } else if (hasComma) {
    s = s.replace(',', '.'); // 1234,56
  } else if (hasDot) {
    // só ponto: pode ser milhar (1.304) ou decimal (1304.60)
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3 && parts.slice(0, -1).every(p => p.length <= 3)) {
      s = s.replace(/\./g, ''); // milhar
    }
    // senão mantém como decimal
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function findUrl(row: any[]): string | null {
  for (const cell of row) {
    const s = String(cell ?? '');
    const m = s.match(/https?:\/\/\S+/i);
    if (m) return m[0];
  }
  return null;
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

interface HeaderMap {
  numero?: number;
  tipo?: number;
  parcelas?: number;
  vencimento?: number;
  observacoes?: number;
  link?: number;
  meses: Array<{ col: number; mes: number; ano: number }>;
}

function detectHeader(row: any[], defaultAno: number): HeaderMap | null {
  const map: HeaderMap = { meses: [] };
  let matched = 0;
  for (let i = 0; i < row.length; i++) {
    const n = norm(row[i]);
    if (!n) continue;
    if (/numero|acordo|parcelamento/.test(n) && map.numero == null && !/parcelas/.test(n)) { map.numero = i; matched++; continue; }
    if (/^tipo/.test(n) && map.tipo == null) { map.tipo = i; matched++; continue; }
    if (/parcelas/.test(n) && map.parcelas == null) { map.parcelas = i; matched++; continue; }
    if (/vencimento|venc\b/.test(n) && map.vencimento == null) { map.vencimento = i; matched++; continue; }
    if (/observ/.test(n) && map.observacoes == null) { map.observacoes = i; matched++; continue; }
    if (/link|acesso|url/.test(n) && map.link == null) { map.link = i; matched++; continue; }
    // mês
    const tokens = n.split(/[\s\/_-]+/);
    for (const t of tokens) {
      if (t in MESES_PT) {
        const anoMatch = n.match(/(20\d{2})/);
        map.meses.push({ col: i, mes: MESES_PT[t], ano: anoMatch ? parseInt(anoMatch[1], 10) : defaultAno });
        matched++;
        break;
      }
    }
  }
  return matched >= 2 ? map : null;
}

export function parsePassivosWorkbook(buffer: ArrayBuffer): ParsedPassivo[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const results: ParsedPassivo[] = [];
  const defaultAno = new Date().getFullYear();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

    let currentCnpj = '';
    let currentEmpresa = '';
    let header: HeaderMap | null = null;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every(c => String(c ?? '').trim() === '')) continue;

      // detectar CNPJ no início do bloco
      const cnpjCell = row.find(c => isCnpj(c));
      if (cnpjCell) {
        currentCnpj = onlyDigits(cnpjCell);
        // empresa = primeira célula não-vazia que não seja o CNPJ
        currentEmpresa = String(
          row.find(c => {
            const s = String(c ?? '').trim();
            return s && !isCnpj(c) && !/^cnpj/i.test(s);
          }) ?? ''
        ).trim();
        header = null;
        continue;
      }

      // tentar detectar cabeçalho
      const maybeHeader = detectHeader(row, defaultAno);
      if (maybeHeader && (maybeHeader.numero != null || maybeHeader.parcelas != null)) {
        header = maybeHeader;
        continue;
      }

      // linha de dados — precisa ter CNPJ e cabeçalho ativos
      if (!currentCnpj || !header) continue;

      const numero = header.numero != null ? String(row[header.numero] ?? '').trim() : '';
      const parcelasRaw = header.parcelas != null ? row[header.parcelas] : '';
      const p = parseParcelas(parcelasRaw);
      if (!numero && !p) continue; // linha vazia/ruído

      const obs = header.observacoes != null ? String(row[header.observacoes] ?? '').trim() : '';
      const link = (header.link != null ? String(row[header.link] ?? '').trim() : '') || findUrl(row) || '';
      const tipo = (header.tipo != null ? String(row[header.tipo] ?? '').trim() : '') || 'OUTROS';
      const dia = header.vencimento != null ? parseDia(row[header.vencimento]) : null;

      const historico: ParsedHistorico[] = [];
      let valorMensal = 0;
      for (const m of header.meses) {
        const v = parseNumber(row[m.col]);
        if (v > 0) {
          historico.push({ ano: m.ano, mes: m.mes, valor: v });
          if (v > valorMensal) valorMensal = v;
        }
      }

      results.push({
        cnpj: currentCnpj,
        empresa_nome: currentEmpresa || '—',
        numero_acordo: numero || `${tipo}-${currentCnpj.slice(-4)}`,
        tipo_parcelamento: tipo.toUpperCase().slice(0, 60),
        parcelas_pagas: p?.pagas ?? 0,
        parcelas_totais: p?.totais ?? 1,
        valor_mensal: valorMensal,
        dia_vencimento: dia,
        parcelas_em_atraso: parseAtrasadas(obs),
        observacoes: obs || null,
        link_acesso: link || null,
        historico,
      });
    }
  }

  return results;
}
