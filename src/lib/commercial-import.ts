import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface SocRow {
  soc_code: string;
  company_name: string;
  legal_name: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  active_lives: number;
  risk_grade: string;
  subgroup: string;
  contract_number: string | null;
  contract_start_date: string | null;
  has_contract: boolean;
  contract_signed: boolean;
  is_active: boolean;
  notes: string | null;
}

export interface ImportItem {
  row: SocRow;
  status: 'novo' | 'atualizar' | 'identico' | 'erro';
  errorMsg?: string;
  existingId?: string;
}

export interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

function cleanCnpj(val: string | null | undefined): string | null {
  if (!val) return null;
  const cleaned = val.replace(/[^\d]/g, '');
  return cleaned.length >= 11 ? cleaned : null;
}

function parseDate(val: string | null | undefined): string | null {
  if (!val) return null;
  // dd/mm/yyyy
  const parts = val.trim().split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function parseRiskGrade(val: string | number | null | undefined): string {
  // Grau de risco válido NR-4: 1, 2, 3 ou 4. Vazio/0 => string vazia (Não Informado).
  if (val == null || val === '') return '';
  const n = Number(val);
  if (!isNaN(n) && n >= 1 && n <= 4) return String(n);
  return '';
}

export function parseExcelFile(file: File): Promise<SocRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const rows: SocRow[] = jsonRows
          .filter((r) => {
            const code = String(r['Código'] ?? '').trim();
            const name = String(r['Empresa'] ?? '').trim();
            return code && name;
          })
          .map((r) => {
            const contractNum = String(r['Nº. Contrato'] ?? '').trim() || null;
            const contractDate = parseDate(String(r['Dt. Ass. Contrato'] ?? '').trim());
            const hasContract = !!(contractNum || contractDate);
            const contractSigned = !!contractDate;
            const ativa = String(r['Ativa'] ?? '').trim().toUpperCase();

            return {
              soc_code: String(r['Código']).trim(),
              company_name: String(r['Empresa']).trim(),
              legal_name: String(r['Razão Social'] ?? '').trim() || null,
              cnpj: cleanCnpj(String(r['CNPJ'] ?? '')),
              city: String(r['Cidade'] ?? '').trim() || null,
              state: String(r['UF'] ?? '').trim() || null,
              active_lives: parseInt(String(r['Vidas Ativas'] ?? '0')) || 0,
              risk_grade: parseRiskGrade(r['Grau de Risco']),
              subgroup: String(r['Sub Grupo'] ?? '').trim() || 'Sem subgrupo',
              contract_number: contractNum,
              contract_start_date: contractDate,
              has_contract: hasContract,
              contract_signed: contractSigned,
              is_active: ativa !== 'NÃO' && ativa !== 'NAO',
              notes: String(r['Observação'] ?? '').trim() || null,
            };
          });

        resolve(rows);
      } catch (err: any) {
        reject(new Error('Erro ao ler arquivo: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

export async function analyzeImport(rows: SocRow[]): Promise<ImportItem[]> {
  // Fetch existing clients by soc_code and cnpj
  const { data: existing } = await supabase
    .from('commercial_clients')
    .select('id, soc_code, cnpj, company_name, legal_name, city, state, active_lives, risk_grade, subgroup, is_active');

  const bySoc = new Map<string, any>();
  const byCnpj = new Map<string, any>();
  (existing ?? []).forEach((c: any) => {
    if (c.soc_code) bySoc.set(c.soc_code, c);
    if (c.cnpj) byCnpj.set(c.cnpj, c);
  });

  const items: ImportItem[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    // Deduplicate within file
    const key = row.cnpj || `soc:${row.soc_code}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    if (!row.company_name || !row.subgroup) {
      items.push({ row, status: 'erro', errorMsg: 'Campos obrigatórios ausentes' });
      continue;
    }

    const match = bySoc.get(row.soc_code) || (row.cnpj ? byCnpj.get(row.cnpj) : null);

    if (!match) {
      items.push({ row, status: 'novo' });
      continue;
    }

    // Check if basic fields differ
    const basicChanged =
      match.company_name !== row.company_name ||
      match.legal_name !== row.legal_name ||
      match.city !== row.city ||
      match.state !== row.state ||
      match.active_lives !== row.active_lives ||
      match.risk_grade !== row.risk_grade ||
      match.subgroup !== row.subgroup ||
      match.is_active !== row.is_active;

    if (basicChanged) {
      items.push({ row, status: 'atualizar', existingId: match.id });
    } else {
      items.push({ row, status: 'identico', existingId: match.id });
    }
  }

  return items;
}

export async function executeImport(items: ImportItem[]): Promise<ImportResult> {
  const result: ImportResult = { total: items.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  for (const item of items) {
    if (item.status === 'identico') {
      result.skipped++;
      continue;
    }
    if (item.status === 'erro') {
      result.errors++;
      continue;
    }

    try {
      if (item.status === 'novo') {
        const { error } = await supabase.from('commercial_clients').insert({
          soc_code: item.row.soc_code,
          company_name: item.row.company_name,
          legal_name: item.row.legal_name,
          cnpj: item.row.cnpj,
          city: item.row.city,
          state: item.row.state,
          active_lives: item.row.active_lives,
          risk_grade: item.row.risk_grade,
          subgroup: item.row.subgroup,
          contract_number: item.row.contract_number,
          contract_start_date: item.row.contract_start_date,
          has_contract: item.row.has_contract,
          contract_signed: item.row.contract_signed,
          is_active: item.row.is_active,
          notes: item.row.notes,
        } as any);
        if (error) throw error;
        result.inserted++;
      } else if (item.status === 'atualizar' && item.existingId) {
        // Only update SOC-origin fields, never overwrite manual fields
        const { error } = await supabase
          .from('commercial_clients')
          .update({
            company_name: item.row.company_name,
            legal_name: item.row.legal_name,
            city: item.row.city,
            state: item.row.state,
            active_lives: item.row.active_lives,
            risk_grade: item.row.risk_grade,
            subgroup: item.row.subgroup,
            is_active: item.row.is_active,
            soc_code: item.row.soc_code,
            cnpj: item.row.cnpj,
          } as any)
          .eq('id', item.existingId);
        if (error) throw error;
        result.updated++;
      }
    } catch {
      result.errors++;
    }
  }

  return result;
}
