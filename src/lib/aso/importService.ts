import { supabase } from "@/integrations/supabase/client";
import { ASOParsedRow, generateIdInterno, detectUnidade } from "./importParser";

export interface ASOImportResult {
  loteId: string;
  totalImportados: number;
  unidade: string;
}

export async function executeASOImport(
  rows: ASOParsedRow[],
  userId: string,
  userName: string,
  file: File
): Promise<ASOImportResult> {
  const unidade = detectUnidade(rows);

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

  // Insert atendimentos
  const atendimentos = rows.map((row, idx) => ({
    id_interno: generateIdInterno(
      row.data_atendimento!,
      row.agenda,
      row.cpf,
      idx + 1
    ),
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
  const chunkSize = 100;
  for (let i = 0; i < atendimentos.length; i += chunkSize) {
    const chunk = atendimentos.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("aso_atendimentos")
      .insert(chunk as any);
    if (error) throw new Error(`Erro ao inserir atendimentos (lote ${i}): ${error.message}`);
  }

  // Insert audit records for import
  const { error: histErr } = await supabase.from("aso_historico").insert({
    atendimento_id: null as any, // batch-level audit
    user_id: userId,
    user_name: userName,
    acao: "importacao_lote",
    campo: "lote_id",
    valor_novo: lote.id,
    observacao: `Importação de ${rows.length} atendimentos - ${unidade} - ${file.name}`,
  });
  // Non-critical, don't throw

  return {
    loteId: lote.id,
    totalImportados: rows.length,
    unidade,
  };
}
