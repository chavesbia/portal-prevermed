import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Lógica para cancelar um contrato existente e criar um novo rascunho com os mesmos dados
 * para fins de correção de termos contratuais.
 */
export async function cancelarEReenviarContrato(contratoId: string): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // 1. Buscar dados do contrato original
    const { data: original, error: fetchErr } = await supabase
      .from('contract_contratos')
      .select('*')
      .eq('id', contratoId)
      .single();

    if (fetchErr || !original) {
      throw new Error('Não foi possível localizar o contrato original');
    }

    // 2. Cancelar o contrato atual
    const { error: cancelErr } = await supabase
      .from('contract_contratos')
      .update({ 
        status: 'cancelado',
        updated_by: user.id
      })
      .eq('id', contratoId);

    if (cancelErr) throw cancelErr;

    // 3. Registrar evento no contrato antigo
    await supabase.from('contract_eventos').insert({
      contrato_id: contratoId,
      tipo: 'auditoria',
      descricao: 'Cancelado para correção — ver contrato substituto',
      performed_by: user.id,
      detalhes: { motivo: 'Correção de termos' }
    });

    // 4. Criar o novo rascunho (draft) copiando os dados
    // Removemos campos de sistema e IDs de integração
    const { 
      id: _oldId, 
      created_at: _ca, 
      updated_at: _ua, 
      numero_contrato: _num,
      autentique_document_id: _authId,
      pdf_url: _pdf,
      html_final: _html,
      ...dadosParaCopiar 
    } = original;

    const { data: novoDraft, error: createErr } = await supabase
      .from('contract_contratos')
      .insert({
        ...dadosParaCopiar,
        status: 'rascunho',
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id, numero_contrato')
      .single();

    if (createErr || !novoDraft) throw createErr;

    // 5. Registrar evento no novo contrato
    await supabase.from('contract_eventos').insert({
      contrato_id: novoDraft.id,
      tipo: 'auditoria',
      descricao: `Substitui o contrato ${original.numero_contrato || 'anterior'} — corrigido para novos termos`,
      performed_by: user.id,
      detalhes: { contrato_anterior_id: contratoId, numero_anterior: original.numero_contrato }
    });

    toast.success('Contrato anterior cancelado. Novo rascunho criado para correção.');
    return novoDraft.id;

  } catch (e: any) {
    console.error('Erro ao processar correção de contrato:', e);
    toast.error(e.message || 'Falha ao processar correção');
    throw e;
  }
}
