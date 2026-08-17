import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Cancela um contrato para correção e cria um novo rascunho com os mesmos dados.
 * 
 * @param contratoId ID do contrato a ser cancelado
 * @param auditoriaMsg Mensagem para o log de auditoria do contrato cancelado
 * @returns O ID do novo rascunho criado
 */
export async function cancelarEReenviarContrato(contratoId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // 1. Buscar dados do contrato atual
    const { data: contrato, error: fetchError } = await supabase
      .from('contract_contratos')
      .select('*')
      .eq('id', contratoId)
      .single();

    if (fetchError || !contrato) throw fetchError || new Error("Contrato não encontrado");

    // 2. Mudar status do contrato ATUAL para cancelado
    const { error: updateError } = await supabase
      .from('contract_contratos')
      .update({ 
        status: 'cancelado',
        updated_by: user.id
      })
      .eq('id', contratoId);

    if (updateError) throw updateError;

    // 3. Registrar na timeline do cancelado
    await supabase.from('contract_eventos').insert({
      contrato_id: contratoId,
      tipo: 'auditoria',
      detalhes: { 
        mensagem: "Cancelado para correção — ver contrato substituto",
        data: new Date().toISOString()
      },
      created_by: user.id
    });

    // 4. Criar o novo rascunho com os mesmos dados
    // Removemos os campos que não devem ser duplicados ou que devem ser reiniciados
    const { 
      id: _oldId, 
      created_at: _ca, 
      updated_at: _ua, 
      numero_contrato: _num,
      autentique_document_id: _aut,
      pdf_url: _pdf,
      status: _stat,
      ...novoPayload 
    } = contrato;

    // Garante que o status seja rascunho
    (novoPayload as any).status = 'rascunho';
    (novoPayload as any).created_by = user.id;
    (novoPayload as any).updated_by = user.id;
    
    // Atualiza data de emissão para hoje se for rascunho novo
    (novoPayload as any).data_emissao = new Date().toISOString().slice(0, 10);

    const { data: novoContrato, error: insertError } = await supabase
      .from('contract_contratos')
      .insert(novoPayload)
      .select('id, numero_contrato')
      .single();

    if (insertError) throw insertError;

    // 5. Registrar na timeline do NOVO
    await supabase.from('contract_eventos').insert({
      contrato_id: novoContrato.id,
      tipo: 'auditoria',
      detalhes: { 
        mensagem: `Substitui o contrato ${contrato.numero_contrato}`,
        contrato_anterior_id: contratoId,
        contrato_anterior_numero: contrato.numero_contrato,
        data: new Date().toISOString()
      },
      created_by: user.id
    });

    toast.success("Contrato cancelado e novo rascunho criado");
    return novoContrato.id;

  } catch (error: any) {
    console.error("Erro ao cancelar e reenviar contrato:", error);
    toast.error(error.message || "Erro ao processar correção");
    throw error;
  }
}
