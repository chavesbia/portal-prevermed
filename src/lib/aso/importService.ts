import { supabase } from "@/integrations/supabase/client";
import { ASOParsedRow, generateIdInterno, detectUnidade } from "./importParser";

export interface ASOImportResult {
  loteId: string;
  totalImportados: number;
  totalIgnorados: number;
  unidade: string;
}

export async function executeASOImport(
  rows: ASOParsedRow[],
  userId: string,
  userName: string,
  file: File,
  unidadeOverride?: string
): Promise<ASOImportResult> {
  const unidade = unidadeOverride || detectUnidade(rows);

  // Create import batch
  const { data: lote, error: loteErr } = await supabase
    .from("aso_lotes_importacao")
    .insert({
      unidade,
      arquivo_nome: file.name,
      arquivo_tamanho: file.size,
      total_registros: rows.length,
      importado_por: userId,
      importado_por_nome: userName,
    })
    .select("id")
    .single();

  if (loteErr || !lote) throw new Error("Erro ao criar lote: " + loteErr?.message);

  // Build atendimentos with lote-unique id_interno (include lote.id prefix to avoid collision)
  const loteShort = lote.id.slice(0, 8);
  const atendimentos = rows.map((row, idx) => ({
    id_interno: `${generateIdInterno(
      row.data_atendimento!,
      unidade,
      row.cpf,
      idx + 1
    )}-${loteShort}`,
    lote_id: lote.id,
    agenda: row.agenda,
    data_atendimento: row.data_atendimento!,
    hora_inicial: row.hora_inicial,
    detalhes: row.detalhes,
    medico: row.medico,
    exames_texto: row.exames_texto,
    riscos: row.riscos,
    tipo_compromisso: row.tipo_compromisso,
    empresa: row.empresa,
    unidade: row.unidade,
    setor: row.setor,
    cargo: row.cargo,
    funcionario: row.funcionario,
    cpf: row.cpf,
    usuario_soc: row.usuario_soc,
    status: "importado" as const,
    setor_responsavel: "Recepção",
  }));

  // Insert in chunks of 100
  let totalImportados = 0;
  let totalIgnorados = 0;
  const chunkSize = 100;
  for (let i = 0; i < atendimentos.length; i += chunkSize) {
    const chunk = atendimentos.slice(i, i + chunkSize);
    const { error, data } = await supabase
      .from("aso_atendimentos")
      .insert(chunk as any)
      .select("id");
    if (error) {
      // If it's a unique constraint error, try inserting one by one to skip duplicates
      if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
        for (const item of chunk) {
          const { error: singleErr } = await supabase
            .from("aso_atendimentos")
            .insert(item as any);
          if (singleErr) {
            totalIgnorados++;
          } else {
            totalImportados++;
          }
        }
      } else {
        throw new Error(`Erro ao inserir atendimentos (lote ${i}): ${error.message}`);
      }
    } else {
      totalImportados += data?.length ?? chunk.length;
    }
  }

  // Update lote with actual count
  if (totalImportados !== rows.length) {
    await supabase.from("aso_lotes_importacao").update({ total_registros: totalImportados } as any).eq("id", lote.id);
  }

  // Insert audit records for import
  await supabase.from("aso_historico").insert({
    atendimento_id: null as any, // batch-level audit
    user_id: userId,
    user_name: userName,
    acao: "importacao_lote",
    campo: "lote_id",
    valor_novo: lote.id,
    observacao: `Importação de ${totalImportados} atendimentos (${totalIgnorados} ignorados) - ${unidade} - ${file.name}`,
  });

  return {
    loteId: lote.id,
    totalImportados,
    totalIgnorados,
    unidade,
  };
}
