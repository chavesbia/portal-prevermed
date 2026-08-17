import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Gera o próximo número de contrato com sufixo de revisão (A, B, C...)
 */
async function gerarNumeroComSufixo(numeroOriginal: string): Promise<string> {
  const match = numeroOriginal.match(/^(CTR-\d{4}-\d{4})([A-Z])?$/);
  if (!match) return `${numeroOriginal}A`; // Fallback se não seguir o padrão

  const base = match[1];
  const sufixoAtual = match[2] || '';
  
  let proximoSufixo = 'A';
  if (sufixoAtual) {
    const charCode = sufixoAtual.charCodeAt(0);
    proximoSufixo = String.fromCharCode(charCode + 1);
  }

  const novoNumero = `${base}${proximoSufixo}`;

  // Verificar se já existe (raro, mas segurança)
  const { data: existe } = await supabase
    .from('contract_contratos')
    .select('id')
    .eq('numero_contrato', novoNumero)
    .maybeSingle();

  if (existe) {
    return gerarNumeroComSufixo(novoNumero); // Recursivo se houver colisão
  }

  return novoNumero;
}

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

    // 4. Gerar o número do contrato substituto com sufixo
    const novoNumero = await gerarNumeroComSufixo(original.numero_contrato);

    // 5. Criar o novo rascunho (draft) copiando os dados
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
        numero_contrato: novoNumero,
        status: 'rascunho',
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id, numero_contrato')
      .single();

    if (createErr || !novoDraft) throw createErr;

    // 6. Registrar evento no novo contrato
    await supabase.from('contract_eventos').insert({
      contrato_id: novoDraft.id,
      tipo: 'auditoria',
      descricao: `Substitui o contrato ${original.numero_contrato || 'anterior'} — corrigido para novos termos`,
      performed_by: user.id,
      detalhes: { 
        contrato_anterior_id: contratoId, 
        numero_anterior: original.numero_contrato,
        is_revisao: true
      }
    });

    toast.success('Contrato anterior cancelado. Novo rascunho criado para correção.');
    return novoDraft.id;

  } catch (e: any) {
    console.error('Erro ao processar correção de contrato:', e);
    toast.error(e.message || 'Falha ao processar correção');
    throw e;
  }
}
