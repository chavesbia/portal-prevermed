import { supabase } from "@/integrations/supabase/client";
import type { ParsedRow } from "./importParser";

export interface ImportResult {
  totalRows: number;
  guiasCriadas: number;
  guiasAtualizadas: number;
  examesCriados: number;
  examesAtualizados: number;
}

export async function executeImport(
  rows: ParsedRow[],
  userId: string,
  userName: string,
  fileName: string,
  fileSize: number
): Promise<ImportResult> {
  const now = new Date().toISOString();
  const result: ImportResult = {
    totalRows: rows.length,
    guiasCriadas: 0,
    guiasAtualizadas: 0,
    examesCriados: 0,
    examesAtualizados: 0,
  };

  const guiaMap = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const existing = guiaMap.get(row.guia_codigo) ?? [];
    existing.push(row);
    guiaMap.set(row.guia_codigo, existing);
  }

  for (const [guiaCodigo, guiaRows] of guiaMap) {
    const firstRow = guiaRows[0];

    const { data: existingGuia } = await supabase
      .from("guias")
      .select("id")
      .eq("guia_codigo", guiaCodigo)
      .maybeSingle();

    const guiaData = {
      guia_codigo: guiaCodigo,
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

    if (existingGuia) {
      const { error } = await supabase
        .from("guias")
        .update(guiaData)
        .eq("id", existingGuia.id);
      if (error) throw error;
      guiaId = existingGuia.id;
      result.guiasAtualizadas++;
    } else {
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
        guia_codigo: guiaCodigo,
      });
    }

    for (const row of guiaRows) {
      if (!row.exame_codigo && !row.exame_nome) continue;

      const { data: existingExame } = await supabase
        .from("guia_exames")
        .select("id")
        .eq("guia_codigo", guiaCodigo)
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
          guia_codigo: guiaCodigo,
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
