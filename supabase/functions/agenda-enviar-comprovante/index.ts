// Reenvio do comprovante de pré-agendamento (botão do aviãozinho). Modelo fixo; exige protocolo + CPF do colaborador.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { emailAgenda } from '../_shared/agendaEmails.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const Body = z.object({ protocolo: z.string().trim().min(5).max(40), cpf: z.string().regex(/^\d{11}$/), email: z.string().trim().email().max(160) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const p = Body.safeParse(await req.json());
    if (!p.success) return json({ error: 'Dados inválidos' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: ag } = await admin.from('soc_agendamentos').select('id, data_agendada, aprovacao_status, fila_aprovacao')
      .eq('protocolo', p.data.protocolo).eq('colaborador_cpf', p.data.cpf).maybeSingle();
    if (!ag || !ag.data_agendada) return json({ error: 'Protocolo não encontrado' }, 404);
    const modelo = ag.aprovacao_status === 'pendente' ? 'agenda-protocolo-aberto' : 'agenda-confirmado';
    // Limite: mesmo protocolo + e-mail só envia uma vez por hora
    const hora = new Date().toISOString().slice(0, 13);
    const r: any = await emailAgenda(admin, ag.id, modelo, { idem: hora }, p.data.email.toLowerCase());
    await admin.from('audit_log').insert({ user_id: null, action_type: 'agenda_comprovante_email', object_type: 'soc_agendamento', object_id: ag.id, details: { email: p.data.email, enviado: !!r?.sent } });
    if (!r?.sent) return json({ error: r?.reason === 'recipient_suppressed' ? 'Este e-mail optou por não receber mensagens.' : 'Não foi possível enviar agora.' }, 502);
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
});
