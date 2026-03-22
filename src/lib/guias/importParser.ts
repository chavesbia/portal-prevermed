import * as XLSX from "xlsx";

export interface ParsedRow {
  guia_codigo: string;
  data_guia: string | null;
  medico_codigo: string | null;
  medico_nome: string | null;
  tipo_exame: string | null;
  situacao: string | null;
  atendido_texto: string | null;
  funcionario_codigo: string | null;
  funcionario_nome: string | null;
  funcionario_cpf: string | null;
  prestador_codigo: string | null;
  prestador_nome: string | null;
  prestador_email: string | null;
  prestador_telefone: string | null;
  prestador_socnet_codigo: string | null;
  prestador_socnet_nome: string | null;
  empresa_codigo: string | null;
  empresa_nome: string | null;
  unidade_nome: string | null;
  exame_codigo: string | null;
  exame_nome: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  pedido_codigo_sequencial: string | null;
  solicitante_nome: string | null;
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  "Código": "guia_codigo",
  "Data da Guia": "data_guia",
  "Código do Médico": "medico_codigo",
  "Médico": "medico_nome",
  "Tipo de Exame": "tipo_exame",
  "Situação": "situacao",
  "Atendido": "atendido_texto",
  "Código do Funcionário": "funcionario_codigo",
  "Funcionário": "funcionario_nome",
  "CPF Funcionário": "funcionario_cpf",
  "Código do Prestador": "prestador_codigo",
  "Nome Prestador": "prestador_nome",
  "Email Prestador": "prestador_email",
  "Telefone Prestador": "prestador_telefone",
  "Código Prestador SOCNET": "prestador_socnet_codigo",
  "Nome Prestador SOCNET": "prestador_socnet_nome",
  "Código da Empresa": "empresa_codigo",
  "Empresa": "empresa_nome",
  "Unidade": "unidade_nome",
  "Código do Exame": "exame_codigo",
  "Exame": "exame_nome",
  "Data Agendamento": "data_agendamento",
  "Hora Agendamento": "hora_agendamento",
  "Código sequencial do Pedido": "pedido_codigo_sequencial",
  "Nome do Solicitante": "solicitante_nome",
};

// Fields that should be uppercased on import
const UPPERCASE_FIELDS: (keyof ParsedRow)[] = [
  "empresa_nome",
  "prestador_nome",
  "funcionario_nome",
  "tipo_exame",
  "solicitante_nome",
  "medico_nome",
  "unidade_nome",
  "prestador_socnet_nome",
  "exame_nome",
  "situacao",
  "atendido_texto",
];

function parseExcelDate(value: any): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof value === "string") {
    const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (parts) return `${parts[3]}-${parts[2]}-${parts[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  return null;
}

function cellStr(value: any): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim();
}

export function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        let sheetName = workbook.SheetNames.find(
          (n) => n.toLowerCase().includes("rel de guias emitidas") || n.toLowerCase().includes("guias emitidas")
        );
        if (!sheetName) sheetName = workbook.SheetNames[0];

        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

        if (jsonData.length === 0) {
          reject(new Error("Planilha vazia ou sem dados."));
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const mapping: Record<string, keyof ParsedRow> = {};
        for (const header of headers) {
          const trimmed = header.trim();
          if (COLUMN_MAP[trimmed]) {
            mapping[header] = COLUMN_MAP[trimmed];
          }
        }

        const rows: ParsedRow[] = [];
        for (const raw of jsonData) {
          const row: any = {};
          for (const [originalHeader, mappedKey] of Object.entries(mapping)) {
            const val = raw[originalHeader];
            if (mappedKey === "data_guia" || mappedKey === "data_agendamento") {
              row[mappedKey] = parseExcelDate(val);
            } else {
              row[mappedKey] = cellStr(val);
            }
          }
          if (!row.guia_codigo) continue;

          // Apply uppercase normalization to text fields
          for (const field of UPPERCASE_FIELDS) {
            if (row[field] && typeof row[field] === "string") {
              row[field] = row[field].toUpperCase();
            }
          }

          rows.push(row as ParsedRow);
        }

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}
