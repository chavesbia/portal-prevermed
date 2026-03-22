import { supabase } from "@/integrations/supabase/client";
import type { ParsedRow } from "./importParser";
import { isPrestadorInterno } from "./blocklist";

export interface DiffField {
  campo: string;
  antigo: string | null;
  novo: string | null;
}

export interface GuiaImportItem {
  guiaCodigo: string;
  status: "nova" | "identica" | "divergente";
  diffs: DiffField[];
  rows: ParsedRow[];
  selected: boolean; // user decision for divergent
}

export interface ImportAnalysis {
  items: GuiaImportItem[];
  filteredCount: number; // prestadores internos removidos
}

export interface ImportResult {
  totalRows: number;
  guiasCriadas: number;
  guiasAtualizadas: number;
  examesCriados: number;
  examesAtualizados: number;
  guiasIgnoradas: number;
}

/** Normalize a value for comparison: trim, collapse spaces, lowercase, treat null/undefined/"" as empty */
function normalizeForCompare(val: unknown): string {
  if (val == null) return "";
  return String(val).trim().replace(/\s+/g, " ").toLowerCase();
}

/** Returns true only when the semantic content actually changed */
function hasRealDiff(oldVal: unknown, newVal: unknown): boolean {
  return normalizeForCompare(oldVal) !== normalizeForCompare(newVal);
}

const COMPARE_FIELDS: { key: keyof ParsedRow; label: string }[] = [
  { key: "data_guia", label: "Data Guia" },
  { key: "medico_nome", label: "Médico" },
  { key: "tipo_exame", label: "Tipo Exame" },
  { key: "situacao", label: "Situação" },
  { key: "atendido_texto", label: "Atendido" },
  { key: "funcionario_nome", label: "Funcionário" },
  { key: "funcionario_cpf", label: "CPF" },
  { key: "prestador_nome", label: "Prestador" },
  { key: "empresa_nome", label: "Empresa" },
  { key: "data_agendamento", label: "Data Agendamento" },
  { key: "hora_agendamento", label: "Hora Agendamento" },
];

export async function analyzeImport(rows: ParsedRow[]): Promise<ImportAnalysis> {
  // 1. Filter out internal providers
  const externalRows = rows.filter((r) => !isPrestadorInterno(r.prestador_nome));
  const filteredCount = rows.length - externalRows.length;

  // 2. Group by guia_codigo
  const guiaMap = new Map<string, ParsedRow[]>();
  for (const row of externalRows) {
    const existing = guiaMap.get(row.guia_codigo) ?? [];
    existing.push(row);
    guiaMap.set(row.guia_codigo, existing);
  }

  // 3. Compare with DB
  const codes = Array.from(guiaMap.keys());
  const items: GuiaImportItem[] = [];

  // Fetch existing guias in batches
  const existingMap = new Map<string, any>();
  for (let i = 0; i < codes.length; i += 50) {
    const batch = codes.slice(i, i + 50);
    const { data } = await supabase
      .from("guias")
      .select("guia_codigo, data_guia, medico_nome, tipo_exame, situacao, atendido_texto, funcionario_nome, funcionario_cpf, prestador_nome, empresa_nome, data_agendamento, hora_agendamento")
      .in("guia_codigo", batch);
    data?.forEach((g: any) => existingMap.set(g.guia_codigo, g));
  }

  for (const [code, guiaRows] of guiaMap) {
    const existing = existingMap.get(code);
    if (!existing) {
      items.push({ guiaCodigo: code, status: "nova", diffs: [], rows: guiaRows, selected: true });
      continue;
    }

    const firstRow = guiaRows[0];
    const diffs: DiffField[] = [];
    for (const f of COMPARE_FIELDS) {
      const oldRaw = existing[f.key];
      const newRaw = firstRow[f.key];
      if (!hasRealDiff(oldRaw, newRaw)) continue;
      diffs.push({ campo: f.label, antigo: oldRaw, novo: newRaw });
    }

    if (diffs.length === 0) {
      items.push({ guiaCodigo: code, status: "identica", diffs: [], rows: guiaRows, selected: false });
    } else {
      items.push({ guiaCodigo: code, status: "divergente", diffs, rows: guiaRows, selected: false });
    }
  }

  return { items, filteredCount };
}

export async function executeImport(
  analysis: ImportAnalysis,
  userId: string,
  userName: string,
  fileName: string,
  fileSize: number
): Promise<ImportResult> {
  const now = new Date().toISOString();
  const result: ImportResult = {
    totalRows: 0,
    guiasCriadas: 0,
    guiasAtualizadas: 0,
    examesCriados: 0,
    examesAtualizados: 0,
    guiasIgnoradas: 0,
  };

  for (const item of analysis.items) {
    if (item.status === "identica") {
      result.guiasIgnoradas++;
      continue;
    }
    if (item.status === "divergente" && !item.selected) {
      result.guiasIgnoradas++;
      continue;
    }

    const firstRow = item.rows[0];
    result.totalRows += item.rows.length;

    const guiaData = {
      guia_codigo: item.guiaCodigo,
      data_guia: firstRow.data_guia,
      medico_codigo: firstRow.medico_codigo,
      medico_nome: firstRow.medico_nome,
      tipo_exame: firstRow.tipo_exame,
      situacao: firstRow.situacao,
      atendido_texto: firstRow.atendido_texto,
      funcionario_codigo: firstRow.funcionario_codigo,
      funcionario_nome: firstRow.funcionario_nome,
      funcionario_cpf: firstRow.funcionario_cpf,
      prestador_codigo: firstRow.prestador_codigo,
      prestador_nome: firstRow.prestador_nome,
      prestador_email: firstRow.prestador_email,
      prestador_telefone: firstRow.prestador_telefone,
      prestador_socnet_codigo: firstRow.prestador_socnet_codigo,
      prestador_socnet_nome: firstRow.prestador_socnet_nome,
      empresa_codigo: firstRow.empresa_codigo,
      empresa_nome: firstRow.empresa_nome,
      unidade_nome: firstRow.unidade_nome,
      data_agendamento: firstRow.data_agendamento,
      hora_agendamento: firstRow.hora_agendamento,
      pedido_codigo_sequencial: firstRow.pedido_codigo_sequencial,
      solicitante_nome: firstRow.solicitante_nome,
      last_seen_at: now,
      last_import_at: now,
      last_import_by: userId,
    };

    let guiaId: string;

    if (item.status === "nova") {
      const { data, error } = await supabase
        .from("guias")
        .insert(guiaData)
        .select("id")
        .single();
      if (error) throw error;
      guiaId = data.id;
      result.guiasCriadas++;

      await supabase.from("guia_gestao").insert({
        guia_id: guiaId,
        guia_codigo: item.guiaCodigo,
      });
    } else {
      // divergente + selected = user chose to update
      const { data: existingGuia } = await supabase
        .from("guias")
        .select("id")
        .eq("guia_codigo", item.guiaCodigo)
        .single();
      if (!existingGuia) continue;

      const { error } = await supabase
        .from("guias")
        .update(guiaData)
        .eq("id", existingGuia.id);
      if (error) throw error;
      guiaId = existingGuia.id;
      result.guiasAtualizadas++;
    }

    // Upsert exames
    for (const row of item.rows) {
      if (!row.exame_codigo && !row.exame_nome) continue;

      const { data: existingExame } = await supabase
        .from("guia_exames")
        .select("id")
        .eq("guia_codigo", item.guiaCodigo)
        .eq("exame_codigo", row.exame_codigo ?? "")
        .eq("exame_nome", row.exame_nome ?? "")
        .maybeSingle();

      if (existingExame) {
        await supabase
          .from("guia_exames")
          .update({ last_seen_at: now })
          .eq("id", existingExame.id);
        result.examesAtualizados++;
      } else {
        await supabase.from("guia_exames").insert({
          guia_id: guiaId,
          guia_codigo: item.guiaCodigo,
          exame_codigo: row.exame_codigo,
          exame_nome: row.exame_nome,
          last_seen_at: now,
        });
        result.examesCriados++;
      }
    }
  }

  await supabase.from("guia_imports").insert({
    imported_by: userId,
    imported_by_name: userName,
    file_name: fileName,
    file_size: fileSize,
    total_rows_lidas: result.totalRows,
    total_guias_criadas: result.guiasCriadas,
    total_guias_atualizadas: result.guiasAtualizadas,
    total_exames_criados: result.examesCriados,
    total_exames_atualizados: result.examesAtualizados,
  });

  return result;
}
