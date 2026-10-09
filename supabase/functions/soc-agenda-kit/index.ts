// Completar pré-agendamento: o parceiro envia kit (guia, ficha clínica, ASO) ou documentos depois, com protocolo + CPF
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { salvarArquivo } from '../_shared/arquivos.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Chave = { protocolo: z.string().trim().toUpperCase().regex(/^AG-\d{8}-[A-F0-9]{6}$/), cpf: z.string().regex(/^\d{11}$/) };
const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('consultar'), ...Chave }),
  z.object({
    acao: z.literal('enviar'), ...Chave,
    arquivos: z.array(z.object({
      tipoDocumento: z.string().trim().min(2).max(80),
      nome: z.string().max(120),
      tipo: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
      base64: z.string().max(7_000_000),
    })).min(1).max(6),
  }),
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Protocolo ou CPF inválido' }, 400);
    const b = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: ag } = await admin.from('soc_agendamentos')
      .select('id, protocolo, colaborador_nome, empresa_nome, tipo_exame, data_agendada, hora_agendada, status, aprovacao_status, devolucao_motivo')
      .eq('protocolo', b.protocolo).eq('colaborador_cpf', b.cpf).maybeSingle();
    if (!ag) return json({ error: 'Pré-agendamento não encontrado. Confira o protocolo e o CPF.' }, 404);
    if (['cancelado', 'atendido'].includes(ag.status)) return json({ error: 'Este agendamento não aceita mais anexos.' }, 400);

    const { data: docs } = await admin.from('soc_agendamento_anexos').select('tipo_documento, nome_arquivo, enviado_em').eq('agendamento_id', ag.id).order('enviado_em');
    if (b.acao === 'consultar') {
      const { id: _id, ...info } = ag;
      return json({ agendamento: info, anexos: docs ?? [] });
    }

    const novos = [];
    try {
      for (const a of b.arquivos) novos.push({ agendamento_id: ag.id, tipo_documento: a.tipoDocumento, nome_arquivo: a.nome, path: await salvarArquivo(admin, ag.data_agendada, a) });
    } catch (e) { return json({ error: (e as Error).message }, 400); }
    await admin.from('soc_agendamento_anexos').insert(novos);
    // Documentação devolvida e reenviada volta para a fila de aprovação
    if (ag.aprovacao_status === 'devolvido') {
      await admin.from('soc_agendamentos').update({ aprovacao_status: 'pendente', status: 'aguardando_aprovacao' }).eq('id', ag.id);
    }
    return json({ ok: true, enviados: novos.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
