import * as XLSX from "xlsx";

export interface ASOParsedRow {
  agenda: string | null;
  data_atendimento: string | null;
  hora_inicial: string | null;
  detalhes: string | null;
  medico: string | null;
  exames_texto: string | null;
  riscos: string | null;
  tipo_compromisso: string | null;
  empresa: string | null;
  unidade: string | null;
  setor: string | null;
  cargo: string | null;
  funcionario: string | null;
  cpf: string | null;
  usuario_soc: string | null;
}

const COLUMN_MAP: Record<string, keyof ASOParsedRow> = {
  "Agenda": "agenda",
  "Data": "data_atendimento",
  "Hora.Inicial": "hora_inicial",
  "Hora Inicial": "hora_inicial",
  "HoraInicial": "hora_inicial",
  "Detalhes": "detalhes",
  "Médico": "medico",
  "Medico": "medico",
  "Exames": "exames_texto",
  "Riscos": "riscos",
  "TipoCompromisso": "tipo_compromisso",
  "Tipo Compromisso": "tipo_compromisso",
  "Tipo.Compromisso": "tipo_compromisso",
  "Tipo de Compromisso": "tipo_compromisso",
  "Empresa": "empresa",
  "Unidade": "unidade",
  "Setor": "setor",
  "Cargo": "cargo",
  "Funcionário": "funcionario",
  "Funcionario": "funcionario",
  "CPF": "cpf",
  "Nome Usuário": "usuario_soc",
  "Nome Usuario": "usuario_soc",
  "NomeUsuario": "usuario_soc",
  "Usuário": "usuario_soc",
};

function normalizeHeader(h: string): string {
  return h.replace(/[\r\n]+/g, " ").trim();
}

function normalizeKey(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const NORMALIZED_COLUMN_MAP: Record<string, keyof ASOParsedRow> = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([k, v]) => [normalizeKey(k), v])
) as any;

function parseDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(val).trim();
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function normalizeCPF(val: any): string | null {
  if (!val) return null;
  return String(val).replace(/\D/g, "").padStart(11, "0") || null;
}

export async function parseASOFile(file: File): Promise<ASOParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (raw.length === 0) throw new Error("Planilha vazia");

  const headers = Object.keys(raw[0]);
  const mapping: Record<string, keyof ASOParsedRow> = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (COLUMN_MAP[norm]) {
      mapping[h] = COLUMN_MAP[norm];
      continue;
    }
    const key = normalizeKey(h);
    if (NORMALIZED_COLUMN_MAP[key]) {
      mapping[h] = NORMALIZED_COLUMN_MAP[key];
    }
  }

  if (!Object.values(mapping).includes("data_atendimento")) {
    throw new Error("Coluna 'Data' não encontrada na planilha");
  }

  const rows: ASOParsedRow[] = [];
  for (const r of raw) {
    const row: ASOParsedRow = {
      agenda: null, data_atendimento: null, hora_inicial: null, detalhes: null,
      medico: null, exames_texto: null, riscos: null, tipo_compromisso: null,
      empresa: null, unidade: null, setor: null, cargo: null,
      funcionario: null, cpf: null, usuario_soc: null,
    };
    for (const [origCol, field] of Object.entries(mapping)) {
      const val = r[origCol];
      if (field === "data_atendimento") {
        row[field] = parseDate(val);
      } else if (field === "cpf") {
        row[field] = normalizeCPF(val);
      } else {
        row[field] = val != null ? String(val).trim() : null;
      }
    }
    if (row.data_atendimento) {
      rows.push(row);
    }
  }

  return rows;
}

export function detectUnidade(rows: ASOParsedRow[]): string {
  const agendas = rows.map(r => r.agenda?.toLowerCase() ?? "").filter(Boolean);
  if (agendas.some(a => a.includes("lapa"))) return "Lapa";
  if (agendas.some(a => a.includes("osasco"))) return "Osasco";
  return "Lapa";
}

export function generateIdInterno(
  data: string, 
  agenda: string | null, 
  cpf: string | null, 
  seq: number
): string {
  const dateStr = data.replace(/-/g, "");
  const unid = (agenda || "LAPA").toUpperCase().replace(/\s+/g, "");
  const cpfStr = cpf || "00000000000";
  const seqStr = String(seq).padStart(3, "0");
  return `ASO-${dateStr}-${unid}-${cpfStr}-${seqStr}`;
}
