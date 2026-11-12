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
    const { data: ag } = await admin.from('soc_agendamentos').select('id, data_agendada, aprovacao_status, fila_aprovacao, solicitante')
      .eq('protocolo', p.data.protocolo).eq('colaborador_cpf', p.data.cpf).maybeSingle();
    if (!ag || !ag.data_agendada) return json({ error: 'Protocolo não encontrado' }, 404);
    // Limites: até 3 envios por protocolo/hora e 15 por IP/hora (e-mail de destino livre para o RH)
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { count: porProt } = await admin.from('audit_log').select('id', { count: 'exact', head: true })
      .eq('action_type', 'agenda_comprovante_email').eq('object_id', ag.id).gte('created_at', desde);
    const { count: porIp } = await admin.from('audit_log').select('id', { count: 'exact', head: true })
      .eq('action_type', 'agenda_comprovante_email').eq('details->>ip', ip).gte('created_at', desde);
    if ((porProt ?? 0) >= 3 || (porIp ?? 0) >= 15) return json({ error: 'Limite de envios para este protocolo atingido no momento. Você também pode baixar o comprovante em PDF ou tirar um print desta tela.' }, 429);
    const modelo = ag.aprovacao_status === 'pendente' ? 'agenda-protocolo-aberto' : 'agenda-confirmado';
    const hora = new Date().toISOString().slice(0, 13) + ':' + p.data.email.toLowerCase();
    const r: any = await emailAgenda(admin, ag.id, modelo, { idem: hora }, p.data.email.toLowerCase());
    await admin.from('audit_log').insert({ user_id: null, action_type: 'agenda_comprovante_email', object_type: 'soc_agendamento', object_id: ag.id, details: { email: p.data.email, ip, enviado: !!r?.sent } });
    if (!r?.sent) return json({ error: r?.reason === 'recipient_suppressed' ? 'Este e-mail optou por não receber mensagens.' : 'Não foi possível enviar agora.' }, 502);
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
});
