// Recebe a solicitação pública de agendamento e registra para a recepção
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  unidadeId: z.string().uuid(),
  empresaNome: z.string().trim().min(2).max(200),
  empresaCnpj: z.string().regex(/^\d{14}$/),
  codigoEmpresaSoc: z.string().regex(/^\d{1,12}$/),
  colaboradorNome: z.string().trim().min(3).max(200),
  colaboradorCpf: z.string().regex(/^\d{11}$/),
  tipoExame: z.enum(['Admissional', 'Periódico', 'Demissional', 'Retorno ao Trabalho', 'Mudança de Risco']),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  observacoes: z.string().max(1000).optional(),
  exames: z.array(z.string().trim().min(2).max(80)).max(40).default([]),
  guia: z.object({
    nome: z.string().max(120),
    tipo: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
    base64: z.string().max(7_000_000),
  }).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Dados inválidos', campos: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: unid } = await admin.from('soc_agenda_unidades').select('id, ativo').eq('id', b.unidadeId).maybeSingle();
    if (!unid?.ativo) return json({ error: 'Unidade indisponível' }, 400);

    const { data: emp } = await admin.from('companies').select('razao_social')
      .eq('cnpj', b.empresaCnpj).eq('soc_code', b.codigoEmpresaSoc).eq('is_active', true).maybeSingle();
    if (!emp) return json({ error: 'Empresa não encontrada entre os clientes ativos' }, 400);

    const { data: dup } = await admin.from('soc_agendamentos').select('id')
      .eq('unidade_id', b.unidadeId).eq('data_agendada', b.data).eq('hora_agendada', b.hora)
      .neq('status', 'cancelado').limit(1);
    if (dup?.length) return json({ error: 'Esse horário acabou de ser reservado. Escolha outro.' }, 409);

    const { data, error } = await admin.from('soc_agendamentos').insert({
      unidade_id: b.unidadeId,
      empresa_nome: emp.razao_social,
      empresa_cnpj: b.empresaCnpj,
      codigo_empresa_soc: b.codigoEmpresaSoc,
      colaborador_nome: b.colaboradorNome.toUpperCase(),
      colaborador_cpf: b.colaboradorCpf,
      tipo_exame: b.tipoExame,
      data_agendada: b.data,
      hora_agendada: b.hora,
      observacoes: b.observacoes ?? null,
    }).select('protocolo').single();
    if (error) return json({ error: 'Não foi possível registrar' }, 500);
    return json({ protocolo: data.protocolo });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
