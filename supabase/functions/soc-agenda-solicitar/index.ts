// Recebe a solicitação pública de agendamento, valida as regras da Agenda e grava no SOC
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { incluirAgendamentoSoc, situacaoSoc } from '../_shared/socAgendamento.ts';
import { salvarArquivo } from '../_shared/arquivos.ts';
import { bloqueioExames, bloqueioUnidade, carregarRegras, contarDia, hojeSP, limiteDia } from '../_shared/agendaRegras.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Arquivo = z.object({
  nome: z.string().max(120),
  tipo: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  base64: z.string().max(7_000_000),
});
const Body = z.object({
  unidadeId: z.string().uuid(),
  empresaNome: z.string().trim().min(2).max(200),
  empresaCnpj: z.string().regex(/^\d{14}$/),
  codigoEmpresaSoc: z.string().regex(/^\d{1,12}$/),
  colaboradorNome: z.string().trim().min(3).max(200),
  colaboradorCpf: z.string().regex(/^\d{11}$/),
  tipoExame: z.enum(['Admissional', 'Periódico', 'Demissional', 'Retorno ao Trabalho', 'Mudança de Risco', 'Monitoração Pontual', 'Consulta', 'Consulta Assistencial']),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  observacoes: z.string().max(1000).optional(),
  mudancaRisco: z.string().max(400).optional(),
  motivoRetorno: z.string().trim().max(1000).optional(),
  exames: z.array(z.string().trim().min(2).max(80)).max(40).default([]),
  guia: Arquivo.optional(),
  documentos: z.array(Arquivo.extend({ tipoDocumento: z.string().trim().min(2).max(80) })).max(10).default([]),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Dados inválidos', campos: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const retorno = b.tipoExame === 'Retorno ao Trabalho';

    const { data: unid } = await admin.from('soc_agenda_unidades').select('id, ativo, codigo_agenda').eq('id', b.unidadeId).maybeSingle();
    if (!unid?.ativo) return json({ error: 'Unidade indisponível' }, 400);

    const { data: emp } = await admin.from('companies').select('razao_social')
      .eq('cnpj', b.empresaCnpj).eq('soc_code', b.codigoEmpresaSoc).eq('is_active', true).maybeSingle();
    if (!emp) return json({ error: 'Empresa não encontrada entre os clientes ativos' }, 400);

    // Regras da Agenda conferidas no servidor (mesmas da tela)
    if (b.data <= hojeSP()) return json({ error: 'Escolha uma data a partir de amanhã.' }, 400);
    const regras = await carregarRegras(admin, b.unidadeId);
    const bloqueio = bloqueioUnidade(regras, b.data, b.hora) ?? bloqueioExames(regras, b.data, b.hora, b.exames);
    if (bloqueio) return json({ error: `${bloqueio} Escolha outra data ou horário.` }, 400);
    const lim = limiteDia(regras, b.data, b.tipoExame);
    if (lim !== null && (await contarDia(admin, b.unidadeId, b.data, b.tipoExame)) >= lim) {
      return json({ error: `Limite diário de ${b.tipoExame} atingido nesta data. Escolha outro dia.` }, 400);
    }

    // Retorno ao Trabalho: motivo e documentos obrigatórios
    if (retorno) {
      if (!b.motivoRetorno || b.motivoRetorno.length < 10) return json({ error: 'Explique brevemente o motivo do retorno ao trabalho.' }, 400);
      const { data: exig } = await admin.from('agenda_documentos_exigidos').select('nome').eq('tipo_exame', b.tipoExame).eq('obrigatorio', true);
      const enviados = new Set(b.documentos.map((d) => d.tipoDocumento));
      const faltam = (exig ?? []).map((e: any) => e.nome).filter((n: string) => !enviados.has(n));
      if (faltam.length) return json({ error: `Anexe: ${faltam.join(', ')}.` }, 400);
      if (!b.documentos.length) return json({ error: 'Anexe a documentação do retorno ao trabalho.' }, 400);
    }

    // Cadastro inativo: só Demissional no vínculo existente; Admissional exige novo cadastro antes
    const sit = await situacaoSoc(b.codigoEmpresaSoc, b.colaboradorCpf);
    if (sit?.inativo && b.tipoExame !== 'Demissional') {
      return json({ error: b.tipoExame === 'Admissional'
        ? 'Colaborador com cadastro inativo: registre a nova admissão antes de agendar.'
        : 'Não é possível agendar este tipo de exame para colaborador com cadastro inativo.' }, 400);
    }

    const { data: dup } = await admin.from('soc_agendamentos').select('id')
      .eq('colaborador_cpf', b.colaboradorCpf).eq('data_agendada', b.data)
      .in('status', ['agendado_soc', 'aguardando_aprovacao']).limit(1);
    if (dup?.length) return json({ error: 'Este colaborador já tem agendamento nesta data.' }, 409);

    let guiaPath: string | null = null;
    const anexos: { tipo_documento: string; nome_arquivo: string; path: string }[] = [];
    try {
      if (b.guia) { guiaPath = await salvarArquivo(admin, b.data, b.guia); anexos.push({ tipo_documento: 'Guia', nome_arquivo: b.guia.nome, path: guiaPath }); }
      for (const d of b.documentos) anexos.push({ tipo_documento: d.tipoDocumento, nome_arquivo: d.nome, path: await salvarArquivo(admin, b.data, d) });
    } catch (e) { return json({ error: (e as Error).message }, 400); }
    const exames = [...new Set(b.exames.map((e) => e.toUpperCase()))];

    const { data, error } = await admin.from('soc_agendamentos').insert({
      exames, guia_path: guiaPath, unidade_id: b.unidadeId,
      empresa_nome: emp.razao_social, empresa_cnpj: b.empresaCnpj, codigo_empresa_soc: b.codigoEmpresaSoc,
      colaborador_nome: b.colaboradorNome.toUpperCase(), colaborador_cpf: b.colaboradorCpf,
      tipo_exame: b.tipoExame, data_agendada: b.data, hora_agendada: b.hora,
      observacoes: [b.mudancaRisco, b.observacoes].filter(Boolean).join('\n') || null,
      motivo_retorno: retorno ? b.motivoRetorno : null,
      status: retorno ? 'aguardando_aprovacao' : 'solicitado',
      aprovacao_status: retorno ? 'pendente' : null,
    }).select('id, protocolo').single();
    if (error) return json({ error: 'Não foi possível registrar' }, 500);
    if (anexos.length) await admin.from('soc_agendamento_anexos').insert(anexos.map((a) => ({ ...a, agendamento_id: data.id })));

    // Retorno ao Trabalho só vai para o SOC após aprovação da equipe de saúde
    if (retorno) return json({ protocolo: data.protocolo, agendadoSoc: false, aguardandoAprovacao: true });

    const soc = await incluirAgendamentoSoc({
      codigoEmpresa: b.codigoEmpresaSoc, cpf: b.colaboradorCpf, codigoAgenda: unid.codigo_agenda,
      data: b.data, hora: b.hora, tipoExame: b.tipoExame,
      codigoFuncionarioSoc: sit?.inativo ? sit.codigo ?? undefined : undefined,
      detalhes: [
        `Portal: ${data.protocolo}`,
        `Exames: ${exames.join(', ') || '-'}`,
        b.mudancaRisco ? `ATENÇÃO: ${b.mudancaRisco}` : '',
        guiaPath ? 'Guia: anexada no Portal' : '',
        b.observacoes?.trim() ? `Obs: ${b.observacoes.trim()}` : '',
      ].filter(Boolean).join('\n'),
    });
    await admin.from('soc_agendamentos').update({
      status: soc.ok ? 'agendado_soc' : 'solicitado',
      soc_retorno: { codigoAgendamento: soc.codigoAgendamento ?? null, resposta: soc.resposta },
      soc_erro: soc.ok ? null : soc.erro,
    }).eq('id', data.id);
    return json({ protocolo: data.protocolo, agendadoSoc: soc.ok });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
