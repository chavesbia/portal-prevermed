import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export type ModeloContratual = 'Gestão Ocupacional' | 'Parceira' | 'Por Uso';

export interface CatalogoRow {
  empresa: string;
  cnpj: string;
  telefone: string | null;
  email: string | null;
  contato: string | null;
  proposal_number: string | null;
  prospect_status: string | null;
  modelo_contratual: ModeloContratual | null;
  contract_number: string | null;
  start_date: string | null;
  end_date: string | null;
  due_day: number | null;
  has_exam_table: boolean;
  has_service_table: boolean;
  signed: boolean;
  auto_renewal: boolean;
  renewal_term_months: number | null;
  vencido: boolean;
  contract_year: number | null;
  revisao_pendente: boolean;
}

export interface CatalogoItem {
  row: CatalogoRow;
  status: 'novo_cliente' | 'contrato_novo' | 'contrato_duplicado' | 'erro';
  errorMsg?: string;
  existingClientId?: string;
  willBeCurrent?: boolean;
}

export interface CatalogoResult {
  total: number;
  clientesNovos: number;
  contratosInseridos: number;
  duplicados: number;
  erros: number;
}

function cleanCnpj(val: any): string | null {
  if (val == null) return null;
  const cleaned = String(val).replace(/[^\d]/g, '');
  return cleaned.length === 14 ? cleaned : null;
}

function norm(val: any): string {
  return String(val ?? '').trim();
}

function parseSimNao(val: any): boolean {
  const s = norm(val).toLowerCase();
  return s === 'sim' || s === 's' || s === 'true' || s === '1';
}

function parseModelo(val: any): ModeloContratual | null {
  const s = norm(val).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!s) return null;
  if (s.includes('gestao') || s.includes('ocupacional')) return 'Gestão Ocupacional';
  if (s.includes('parceira') || s.includes('parceiro')) return 'Parceira';
  if (s.includes('por uso') || s === 'uso') return 'Por Uso';
  return null;
}

function parseExcelDate(val: any): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const parts = s.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // ISO?
  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (iso.test(s)) return s.slice(0, 10);
  return null;
}

function parseDueDay(val: any): number | null {
  if (val == null || val === '') return null;
  const n = parseInt(String(val).replace(/\D/g, ''), 10);
  if (!isNaN(n) && n >= 1 && n <= 31) return n;
  return null;
}

function parseRenewalMonths(val: any, autoRenewal: boolean): number | null {
  const s = norm(val).toLowerCase();
  if (!s) return autoRenewal ? 12 : null;
  if (s.includes('ano')) {
    const m = s.match(/(\d+)\s*ano/);
    return m ? parseInt(m[1], 10) * 12 : 12;
  }
  const m = s.match(/(\d+)\s*m/);
  if (m) return parseInt(m[1], 10);
  return autoRenewal ? 12 : null;
}

function parseYear(val: any, fallbackDate: string | null): number | null {
  if (val != null && val !== '') {
    const n = parseInt(String(val).replace(/\D/g, '').slice(0, 4), 10);
    if (!isNaN(n) && n >= 2000 && n <= 2100) return n;
  }
  if (fallbackDate) {
    const y = parseInt(fallbackDate.slice(0, 4), 10);
    if (!isNaN(y)) return y;
  }
  return null;
}

function getField(row: Record<string, any>, ...candidates: string[]): any {
  // Headers in the spreadsheet have trailing spaces and varied casing.
  const keys = Object.keys(row);
  for (const cand in candidates) {
    const want = candidates[cand].trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const k of keys) {
      const kn = k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (kn === want) return row[k];
    }
  }
  return undefined;
}

export function parseCatalogoFile(file: File): Promise<CatalogoRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        // Prefer the "Catalogo" sheet; fallback to first
        const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase().startsWith('catalogo')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const rows: CatalogoRow[] = json
          .filter((r) => {
            const emp = norm(getField(r, 'Empresa'));
            return emp.length > 0;
          })
          .map((r) => {
            const empresa = norm(getField(r, 'Empresa'));
            const cnpj = cleanCnpj(getField(r, 'CNPJ')) || '';
            const start_date = parseExcelDate(getField(r, 'Vigencia inicio', 'Vigência inicio', 'Vigência início'));
            const end_date = parseExcelDate(getField(r, 'Vigência fim', 'Vigencia fim'));
            const modelo = parseModelo(getField(r, 'Tipo de Contrato'));
            const auto_renewal = parseSimNao(getField(r, 'Renovação automatica', 'Renovação automática'));
            return {
              empresa,
              cnpj,
              telefone: norm(getField(r, 'Telefone')) || null,
              email: norm(getField(r, 'Email')) || null,
              contato: norm(getField(r, 'Contato')) || null,
              proposal_number: norm(getField(r, 'Nº Proposta', 'N° Proposta', 'Nº. Proposta')) || null,
              prospect_status: norm(getField(r, 'Situação prospecção', 'Situacao prospeccao')) || null,
              modelo_contratual: modelo,
              contract_number: norm(getField(r, 'Nº Contrato', 'N° Contrato', 'Nº. Contrato')) || null,
              start_date,
              end_date,
              due_day: parseDueDay(getField(r, 'Data de vencimento', 'Dia de vencimento')),
              has_exam_table: parseSimNao(getField(r, 'Tabela de Exames')),
              has_service_table: parseSimNao(getField(r, 'Tabela de Serviços', 'Tabela de Servicos')),
              signed: parseSimNao(getField(r, 'Assinatura')),
              auto_renewal,
              renewal_term_months: parseRenewalMonths(getField(r, 'Tempo de renovação', 'Tempo de renovacao'), auto_renewal),
              vencido: parseSimNao(getField(r, 'Vencido')),
              contract_year: parseYear(getField(r, 'Ano do contrato'), start_date),
              revisao_pendente: !modelo,
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

export async function analyzeCatalogoImport(rows: CatalogoRow[]): Promise<CatalogoItem[]> {
  // Fetch existing clients by CNPJ
  const { data: clients } = await supabase
    .from('commercial_clients')
    .select('id, cnpj');
  const byCnpj = new Map<string, string>();
  (clients ?? []).forEach((c: any) => { if (c.cnpj) byCnpj.set(c.cnpj, c.id); });

  // Fetch existing contracts (id, client_id, contract_number) to detect duplicates
  const { data: existingContracts } = await supabase
    .from('commercial_contracts' as any)
    .select('client_id, contract_number');
  const existingKeySet = new Set<string>();
  (existingContracts ?? []).forEach((c: any) => {
    if (c.client_id && c.contract_number) {
      existingKeySet.add(`${c.client_id}::${String(c.contract_number).trim()}`);
    }
  });

  const items: CatalogoItem[] = [];
  // Group by CNPJ to figure out which row of each new client becomes is_current
  const groups = new Map<string, number[]>(); // cnpj -> indices in items array
  const tempItems: CatalogoItem[] = [];

  rows.forEach((row) => {
    if (!row.cnpj) {
      tempItems.push({ row, status: 'erro', errorMsg: 'CNPJ ausente ou inválido' });
      return;
    }
    const existingClientId = byCnpj.get(row.cnpj);
    if (!existingClientId) {
      tempItems.push({ row, status: 'novo_cliente' });
    } else {
      const key = `${existingClientId}::${(row.contract_number || '').trim()}`;
      if (row.contract_number && existingKeySet.has(key)) {
        tempItems.push({ row, status: 'contrato_duplicado', existingClientId });
      } else {
        tempItems.push({ row, status: 'contrato_novo', existingClientId });
      }
    }
  });

  // Compute is_current per CNPJ:
  // - For new clients: pick row with most recent end_date and not vencido (fallback: most recent end_date overall)
  // - For existing clients: do NOT auto-switch (user keeps control)
  const byCnpjIdx = new Map<string, number[]>();
  tempItems.forEach((it, i) => {
    if (it.status === 'erro' || it.status === 'contrato_duplicado') return;
    const cnpj = it.row.cnpj;
    if (!byCnpjIdx.has(cnpj)) byCnpjIdx.set(cnpj, []);
    byCnpjIdx.get(cnpj)!.push(i);
  });

  byCnpjIdx.forEach((idxs) => {
    // Only set willBeCurrent for groups where ALL rows are novo_cliente (i.e., new client)
    const allNew = idxs.every(i => tempItems[i].status === 'novo_cliente');
    if (!allNew) return;
    let bestIdx = -1;
    let bestDate = '';
    for (const i of idxs) {
      const r = tempItems[i].row;
      if (r.vencido) continue;
      const d = r.end_date || '';
      if (d > bestDate) { bestDate = d; bestIdx = i; }
    }
    // Fallback: if all vencido, take latest end_date anyway so the client has a "vigente" marker
    if (bestIdx === -1) {
      for (const i of idxs) {
        const d = tempItems[i].row.end_date || '';
        if (d > bestDate) { bestDate = d; bestIdx = i; }
      }
      if (bestIdx === -1) bestIdx = idxs[0];
    }
    tempItems[bestIdx].willBeCurrent = true;
  });

  return tempItems;
}

function deriveStatus(row: CatalogoRow): string {
  if (row.vencido) return 'Vencido';
  if (!row.signed) return 'Aguardando assinatura';
  if (!row.end_date) return 'Vigente';
  const today = new Date().toISOString().slice(0, 10);
  if (row.end_date < today) return 'Vencido';
  return 'Vigente';
}

export async function executeCatalogoImport(items: CatalogoItem[]): Promise<CatalogoResult> {
  const result: CatalogoResult = {
    total: items.length,
    clientesNovos: 0,
    contratosInseridos: 0,
    duplicados: 0,
    erros: 0,
  };

  // Cache CNPJ -> client_id for clients we create during this run
  const newClientCache = new Map<string, string>();

  for (const item of items) {
    if (item.status === 'erro') { result.erros++; continue; }
    if (item.status === 'contrato_duplicado') { result.duplicados++; continue; }

    try {
      let clientId = item.existingClientId || newClientCache.get(item.row.cnpj);

      if (!clientId) {
        // Create the client (catalog has no SOC code; CNPJ satisfies the cnpj_or_soc constraint)
        const { data: newClient, error: ecli } = await supabase
          .from('commercial_clients')
          .insert({
            company_name: item.row.empresa,
            cnpj: item.row.cnpj,
            subgroup: 'Sem subgrupo',
            risk_grade: '',
            is_active: true,
            notes: [item.row.telefone && `Tel: ${item.row.telefone}`, item.row.email && `Email: ${item.row.email}`, item.row.contato && `Contato: ${item.row.contato}`]
              .filter(Boolean).join(' | ') || null,
          } as any)
          .select('id')
          .single();
        if (ecli) throw ecli;
        clientId = (newClient as any).id;
        newClientCache.set(item.row.cnpj, clientId!);
        result.clientesNovos++;
      }

      // If we plan to mark this as is_current and the client already has one, clear it first
      if (item.willBeCurrent) {
        await supabase
          .from('commercial_contracts' as any)
          .update({ is_current: false } as any)
          .eq('client_id', clientId!)
          .eq('is_current', true);
      }

      const { error: econ } = await supabase
        .from('commercial_contracts' as any)
        .insert({
          client_id: clientId,
          contract_number: item.row.contract_number,
          proposal_number: item.row.proposal_number,
          prospect_status: item.row.prospect_status,
          modelo_contratual: item.row.modelo_contratual,
          contract_year: item.row.contract_year,
          start_date: item.row.start_date,
          end_date: item.row.end_date,
          signed: item.row.signed,
          auto_renewal: item.row.auto_renewal,
          renewal_term_months: item.row.renewal_term_months,
          has_exam_table: item.row.has_exam_table,
          has_service_table: item.row.has_service_table,
          is_current: !!item.willBeCurrent,
          status_derivado: deriveStatus(item.row),
          revisao_pendente: item.row.revisao_pendente,
          notes: item.row.due_day ? `Dia de vencimento: ${item.row.due_day}` : null,
        } as any);
      if (econ) throw econ;
      result.contratosInseridos++;
    } catch (err: any) {
      result.erros++;
      console.error('Catalogo import error:', err);
    }
  }

  return result;
}
